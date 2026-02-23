"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { MobilePage } from "@/mobile/shared/MobilePage";

type CatalogRow = {
  master_id?: string;
  model_name?: string;
  image_url?: string | null;
  material_code_default?: string | null;
  weight_default_g?: number | null;
  labor_total_sell?: number | null;
  labor_base_sell?: number | null;
};

const PAGE_SIZE = 20;

export function CatalogMobileScreen() {
  const [keyword, setKeyword] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const query = useQuery({
    queryKey: ["cms", "catalog_mobile"],
    queryFn: async () => {
      const response = await fetch("/api/master-items", { cache: "no-store" });
      const json = (await response.json()) as { data?: CatalogRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "카탈로그 조회 실패");
      return json.data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const base = query.data ?? [];
    if (!k) return base;
    return base.filter((row) => String(row.model_name ?? "").toLowerCase().includes(k));
  }, [query.data, keyword]);

  const pageItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  return (
    <MobilePage title="카탈로그" subtitle="모바일 gallery 전용 · 2열 카드">
      <Input
        placeholder="모델명 검색"
        value={keyword}
        onChange={(event) => {
          setKeyword(event.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        {pageItems.map((item, index) => (
          <button
            key={String(item.master_id ?? item.model_name ?? `row-${index}`)}
            type="button"
            className="overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] text-left"
            onClick={() => setSelected(item)}
          >
            <div className="aspect-square w-full bg-[var(--subtle-bg)]">
              {item.image_url ? (
                <img src={item.image_url} alt={item.model_name ?? "catalog-item"} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">No Image</div>
              )}
            </div>
            <div className="p-2">
              <div className="truncate text-sm font-semibold">{item.model_name ?? "-"}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">중량 {Number(item.weight_default_g ?? 0)}g</div>
            </div>
          </button>
        ))}
      </div>

      {visibleCount < filtered.length ? (
        <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
          더보기 ({filtered.length - visibleCount})
        </Button>
      ) : null}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title="상품 상세">
        <div className="flex h-full flex-col p-4">
          {selected ? (
            <>
              <div className="aspect-square w-full overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--subtle-bg)]">
                {selected.image_url ? (
                  <img src={selected.image_url} alt={selected.model_name ?? "catalog-item"} className="h-full w-full object-contain" />
                ) : null}
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-base font-semibold">{selected.model_name ?? "-"}</div>
                <div className="text-xs text-[var(--muted)]">Master ID: {selected.master_id ?? "-"}</div>
                <div className="text-xs text-[var(--muted)]">소재: {selected.material_code_default ?? "-"}</div>
                <div className="text-xs text-[var(--muted)]">중량: {Number(selected.weight_default_g ?? 0)}g</div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>닫기</Button>
                <Link href="/catalog">
                  <Button className="w-full">상세 편집 이동</Button>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </Sheet>
    </MobilePage>
  );
}
