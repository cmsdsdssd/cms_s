#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
import requests
from psycopg import sql
from psycopg.types.json import Jsonb


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"
DEFAULT_LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PAGE_SIZE = 1000
IN_FILTER_CHUNK = 150
INSERT_CHUNK = 200

INITIAL_CHANNEL_TABLES = [
    "sales_channel",
    "sales_channel_account",
    "sales_channel_product",
    "pricing_policy",
    "pricing_adjustment",
    "pricing_override",
    "product_price_guard_v2",
    "channel_base_price_adjustment_log",
    "channel_labor_price_adjustment_log",
    "channel_option_category_v2",
    "channel_option_category_delta_v1",
    "channel_option_labor_rule_v1",
    "channel_option_current_state_v1",
    "channel_option_apply_log_v1",
]

GLOBAL_FULL_TABLES = [
    "cms_market_symbol_role",
    "cms_market_tick",
    "cms_material_factor_config",
]

RULE_CHILD_TABLES = [
    "sync_rule_r1_material_delta",
    "sync_rule_r2_size_weight",
    "sync_rule_r3_color_margin",
    "sync_rule_r4_decoration",
]


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def chunked(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def quote_postgrest_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{text}"'


def adapt_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return Jsonb(value)
    return value


@dataclass(frozen=True)
class ForeignKey:
    column_name: str
    foreign_table_name: str
    foreign_column_name: str


class Importer:
    def __init__(
        self,
        *,
        local_db_url: str,
        remote_url: str,
        remote_key: str,
        channel_id: str,
        explicit_tables: list[str] | None = None,
    ) -> None:
        self.local_db_url = local_db_url
        self.remote_url = remote_url.rstrip("/")
        self.remote_key = remote_key
        self.channel_id = channel_id
        self.explicit_tables = explicit_tables or []
        self.session = requests.Session()
        self.column_meta: dict[str, list[dict[str, Any]]] = {}
        self.primary_keys: dict[str, list[str]] = {}
        self.foreign_keys: dict[str, list[ForeignKey]] = defaultdict(list)
        self.enum_labels: dict[str, set[str]] = {}
        self.rows_by_table: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
        self.fetched_values: dict[str, dict[str, set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )
        self.fetch_log: list[tuple[str, int]] = []
        self.skipped_rows: dict[str, int] = defaultdict(int)

    def run(self) -> None:
        self.load_schema_metadata()
        self.fetch_initial_rows()
        self.insert_rows()
        self.print_summary()

    def load_schema_metadata(self) -> None:
        with psycopg.connect(self.local_db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                      c.table_name,
                      c.column_name,
                      c.ordinal_position,
                      c.is_generated,
                      c.is_identity,
                      c.udt_name
                    from information_schema.columns c
                    where c.table_schema = 'public'
                    order by c.table_name, c.ordinal_position
                    """
                )
                for (
                    table_name,
                    column_name,
                    ordinal_position,
                    is_generated,
                    is_identity,
                    udt_name,
                ) in cur.fetchall():
                    self.column_meta.setdefault(table_name, []).append(
                        {
                            "column_name": column_name,
                            "ordinal_position": ordinal_position,
                            "is_generated": is_generated,
                            "is_identity": is_identity,
                            "udt_name": udt_name,
                        }
                    )

                cur.execute(
                    """
                    select
                      t.typname,
                      e.enumlabel
                    from pg_type t
                    join pg_enum e
                      on e.enumtypid = t.oid
                    join pg_namespace n
                      on n.oid = t.typnamespace
                    where n.nspname = 'public'
                    order by t.typname, e.enumsortorder
                    """
                )
                for type_name, enum_label in cur.fetchall():
                    self.enum_labels.setdefault(type_name, set()).add(enum_label)

                cur.execute(
                    """
                    select
                      tc.table_name,
                      kcu.column_name,
                      kcu.ordinal_position
                    from information_schema.table_constraints tc
                    join information_schema.key_column_usage kcu
                      on tc.constraint_name = kcu.constraint_name
                     and tc.table_schema = kcu.table_schema
                    where tc.table_schema = 'public'
                      and tc.constraint_type = 'PRIMARY KEY'
                    order by tc.table_name, kcu.ordinal_position
                    """
                )
                for table_name, column_name, _ in cur.fetchall():
                    self.primary_keys.setdefault(table_name, []).append(column_name)

                cur.execute(
                    """
                    select
                      tc.table_name,
                      kcu.column_name,
                      ccu.table_name as foreign_table_name,
                      ccu.column_name as foreign_column_name
                    from information_schema.table_constraints tc
                    join information_schema.key_column_usage kcu
                      on tc.constraint_name = kcu.constraint_name
                     and tc.table_schema = kcu.table_schema
                    join information_schema.constraint_column_usage ccu
                      on ccu.constraint_name = tc.constraint_name
                     and ccu.table_schema = tc.table_schema
                    where tc.table_schema = 'public'
                      and tc.constraint_type = 'FOREIGN KEY'
                    order by tc.table_name, kcu.ordinal_position
                    """
                )
                for (
                    table_name,
                    column_name,
                    foreign_table_name,
                    foreign_column_name,
                ) in cur.fetchall():
                    self.foreign_keys[table_name].append(
                        ForeignKey(
                            column_name=column_name,
                            foreign_table_name=foreign_table_name,
                            foreign_column_name=foreign_column_name,
                        )
                    )

    def fetch_initial_rows(self) -> None:
        if self.explicit_tables:
            for table_name in self.explicit_tables:
                self.fetch_all_rows(table_name)
            return
        for table_name in INITIAL_CHANNEL_TABLES:
            self.fetch_by_column_values(table_name, "channel_id", [self.channel_id])
        for table_name in GLOBAL_FULL_TABLES:
            self.fetch_all_rows(table_name)

    def fetch_all_rows(self, table_name: str) -> None:
        rows = self.fetch_remote_rows(table_name, {})
        self.consume_rows(table_name, rows)

    def fetch_by_column_values(
        self, table_name: str, column_name: str, raw_values: list[Any]
    ) -> None:
        values = [
            value
            for value in raw_values
            if value is not None and str(value).strip() != ""
        ]
        if not values:
            return
        pending: list[Any] = []
        seen = self.fetched_values[table_name][column_name]
        for value in values:
            marker = str(value)
            if marker in seen:
                continue
            seen.add(marker)
            pending.append(value)
        if not pending:
            return
        for chunk in chunked(pending, IN_FILTER_CHUNK):
            expr = f"in.({','.join(quote_postgrest_value(value) for value in chunk)})"
            rows = self.fetch_remote_rows(table_name, {column_name: expr})
            self.consume_rows(table_name, rows)

    def fetch_remote_rows(
        self, table_name: str, filters: dict[str, str]
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            params = {"select": "*", **filters}
            response = self.session.get(
                f"{self.remote_url}/rest/v1/{table_name}",
                params=params,
                headers={
                    "apikey": self.remote_key,
                    "Authorization": f"Bearer {self.remote_key}",
                    "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
                },
                timeout=120,
            )
            response.raise_for_status()
            page = response.json()
            if not isinstance(page, list):
                raise RuntimeError(f"Unexpected payload for {table_name}: {page!r}")
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
        self.fetch_log.append((table_name, len(rows)))
        return rows

    def consume_rows(self, table_name: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        new_rows: list[dict[str, Any]] = []
        table_bucket = self.rows_by_table[table_name]
        for row in rows:
            row_key = self.make_row_key(table_name, row)
            if row_key in table_bucket:
                continue
            table_bucket[row_key] = row
            new_rows.append(row)
        if not new_rows:
            return
        self.expand_foreign_key_dependencies(table_name, new_rows)
        self.expand_reverse_dependencies(table_name, new_rows)

    def make_row_key(self, table_name: str, row: dict[str, Any]) -> str:
        primary_key = self.primary_keys.get(table_name, [])
        if primary_key:
            values = [row.get(column_name) for column_name in primary_key]
            return json.dumps(values, default=str, ensure_ascii=True)
        ordered = {key: row.get(key) for key in sorted(row.keys())}
        return json.dumps(ordered, default=str, ensure_ascii=True, sort_keys=True)

    def expand_foreign_key_dependencies(
        self, table_name: str, rows: list[dict[str, Any]]
    ) -> None:
        for fk in self.foreign_keys.get(table_name, []):
            values = [row.get(fk.column_name) for row in rows]
            self.fetch_by_column_values(
                fk.foreign_table_name, fk.foreign_column_name, values
            )

    def expand_reverse_dependencies(
        self, table_name: str, rows: list[dict[str, Any]]
    ) -> None:
        if table_name == "cms_master_item":
            master_ids = [row.get("master_id") for row in rows]
            self.fetch_by_column_values(
                "cms_master_absorb_labor_item_v1", "master_id", master_ids
            )
            self.fetch_by_column_values(
                "cms_bom_recipe", "product_master_id", master_ids
            )
        elif table_name == "cms_bom_recipe":
            bom_ids = [row.get("bom_id") for row in rows]
            self.fetch_by_column_values("cms_bom_recipe_line", "bom_id", bom_ids)
        elif table_name == "sync_rule_set":
            rule_set_ids = [row.get("rule_set_id") for row in rows]
            for child_table in RULE_CHILD_TABLES:
                self.fetch_by_column_values(child_table, "rule_set_id", rule_set_ids)
        elif table_name == "material_factor_set":
            factor_set_ids = [row.get("factor_set_id") for row in rows]
            self.fetch_by_column_values(
                "material_factor", "factor_set_id", factor_set_ids
            )

    def table_order(self) -> list[str]:
        imported_tables = set(self.rows_by_table.keys())
        dependencies: dict[str, set[str]] = {
            table_name: set() for table_name in imported_tables
        }
        reverse_edges: dict[str, set[str]] = {
            table_name: set() for table_name in imported_tables
        }

        for table_name in imported_tables:
            for fk in self.foreign_keys.get(table_name, []):
                if fk.foreign_table_name not in imported_tables:
                    continue
                dependencies[table_name].add(fk.foreign_table_name)
                reverse_edges[fk.foreign_table_name].add(table_name)

        ready = deque(
            sorted(table_name for table_name, deps in dependencies.items() if not deps)
        )
        ordered: list[str] = []
        while ready:
            table_name = ready.popleft()
            ordered.append(table_name)
            for dependent in sorted(reverse_edges[table_name]):
                dependencies[dependent].discard(table_name)
                if not dependencies[dependent]:
                    ready.append(dependent)

        if len(ordered) != len(imported_tables):
            unresolved = sorted(imported_tables.difference(ordered))
            raise RuntimeError(
                f"Could not resolve table order: {', '.join(unresolved)}"
            )
        return ordered

    def insert_rows(self) -> None:
        ordered = self.table_order()
        with psycopg.connect(self.local_db_url) as conn:
            with conn.cursor() as cur:
                for table_name in ordered:
                    rows = list(self.rows_by_table[table_name].values())
                    if not rows:
                        continue
                    self.insert_table_rows(cur, table_name, rows)
            conn.commit()

    def insert_table_rows(
        self, cur: psycopg.Cursor[Any], table_name: str, rows: list[dict[str, Any]]
    ) -> None:
        column_meta = self.column_meta.get(table_name, [])
        column_meta_by_name = {meta["column_name"]: meta for meta in column_meta}
        insert_columns = [
            meta["column_name"]
            for meta in column_meta
            if meta["is_generated"] != "ALWAYS"
        ]
        if not insert_columns:
            return

        has_identity = any(
            meta["is_identity"] == "YES"
            for meta in column_meta
            if meta["column_name"] in insert_columns
        )
        primary_key = [
            column_name
            for column_name in self.primary_keys.get(table_name, [])
            if column_name in insert_columns
        ]
        column_idents = sql.SQL(", ").join(
            sql.Identifier(column_name) for column_name in insert_columns
        )
        placeholder_list = sql.SQL(", ").join(sql.Placeholder() for _ in insert_columns)
        overriding_clause = (
            sql.SQL(" overriding system value") if has_identity else sql.SQL("")
        )
        statement = sql.SQL("insert into {}.{} ({}){} values ({})").format(
            sql.Identifier("public"),
            sql.Identifier(table_name),
            column_idents,
            overriding_clause,
            placeholder_list,
        )
        if primary_key:
            non_pk_columns = [
                column_name
                for column_name in insert_columns
                if column_name not in primary_key
            ]
            if non_pk_columns:
                update_assignments = sql.SQL(", ").join(
                    sql.SQL("{} = excluded.{}").format(
                        sql.Identifier(column_name), sql.Identifier(column_name)
                    )
                    for column_name in non_pk_columns
                )
                statement += sql.SQL(" on conflict ({}) do update set {}").format(
                    sql.SQL(", ").join(
                        sql.Identifier(column_name) for column_name in primary_key
                    ),
                    update_assignments,
                )
            else:
                statement += sql.SQL(" on conflict ({}) do nothing").format(
                    sql.SQL(", ").join(
                        sql.Identifier(column_name) for column_name in primary_key
                    )
                )

        for row_chunk in chunked(rows, INSERT_CHUNK):
            values = []
            for row in row_chunk:
                if self.should_skip_row(
                    table_name, row, insert_columns, column_meta_by_name
                ):
                    self.skipped_rows[table_name] += 1
                    continue
                values.append(
                    tuple(
                        adapt_value(row.get(column_name))
                        for column_name in insert_columns
                    )
                )
            if not values:
                continue
            cur.executemany(statement, values)

    def should_skip_row(
        self,
        table_name: str,
        row: dict[str, Any],
        insert_columns: list[str],
        column_meta_by_name: dict[str, dict[str, Any]],
    ) -> bool:
        for column_name in insert_columns:
            meta = column_meta_by_name[column_name]
            udt_name = str(meta.get("udt_name") or "")
            allowed_values = self.enum_labels.get(udt_name)
            if not allowed_values:
                continue
            value = row.get(column_name)
            if value is None:
                continue
            if str(value) not in allowed_values:
                return True
        return False

    def print_summary(self) -> None:
        ordered = self.table_order()
        print(f"channel_id={self.channel_id}")
        for table_name in ordered:
            print(f"{table_name} rows={len(self.rows_by_table[table_name])}")
            skipped = self.skipped_rows.get(table_name, 0)
            if skipped:
                print(f"{table_name} skipped_rows={skipped}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel-id", required=True)
    parser.add_argument("--local-db-url", default=DEFAULT_LOCAL_DB_URL)
    parser.add_argument("--tables", default="")
    args = parser.parse_args()

    env = load_env(ENV_PATH)
    remote_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    remote_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not remote_url or not remote_key:
        raise RuntimeError(
            "web/.env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )

    importer = Importer(
        local_db_url=args.local_db_url,
        remote_url=remote_url,
        remote_key=remote_key,
        channel_id=str(args.channel_id).strip(),
        explicit_tables=[
            table_name.strip()
            for table_name in str(args.tables).split(",")
            if table_name.strip()
        ],
    )
    importer.run()


if __name__ == "__main__":
    main()
