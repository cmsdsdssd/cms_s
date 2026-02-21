import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const ENFORCEMENT_START = 20260221171000;

const denyPatterns = [
  {
    name: "mutating RPC grant to anon",
    regex: /grant\s+execute\s+on\s+function\s+[^;]+\s+to\s+[^;]*\banon\b/gi,
  },
  {
    name: "anon RLS policy on sensitive tables",
    regex:
      /create\s+policy\s+[^;]+\s+on\s+(?:public\.)?(cms_(?:party|order_line|factory_po|factory_po_line|receipt_inbox|shipment_header|shipment_line|ar_ledger|ar_invoice|ar_payment|ar_payment_alloc|vendor_prefix_map|vendor_fax_config|return_line))[^;]+\s+to\s+anon/gi,
  },
  {
    name: "anon select grant on sensitive objects",
    regex:
      /grant\s+select\s+on\s+(?:table\s+)?(?:public\.)?(cms_(?:party|order_line|factory_po|factory_po_line|receipt_inbox|shipment_header|shipment_line|ar_ledger|ar_invoice|ar_payment|ar_payment_alloc|vendor_prefix_map|vendor_fax_config|return_line)|cms_v_ar_[a-z0-9_]+|cms_v_ap_[a-z0-9_]+)\s+to\s+[^;]*\banon\b/gi,
  },
];

function collectSqlFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_archive") continue;
      out.push(...collectSqlFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const files = collectSqlFiles(migrationsDir);
const violations = [];

for (const file of files) {
  const base = path.basename(file);
  const prefix = Number(base.slice(0, 14));
  if (Number.isFinite(prefix) && prefix < ENFORCEMENT_START) {
    continue;
  }

  const content = fs.readFileSync(file, "utf8");
  for (const rule of denyPatterns) {
    for (const match of content.matchAll(rule.regex)) {
      const idx = match.index ?? 0;
      violations.push({
        file: path.relative(root, file),
        line: lineOf(content, idx),
        rule: rule.name,
        snippet: (match[0] ?? "").replace(/\s+/g, " ").slice(0, 220),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("[anon-guard] denied anon exposure detected:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.rule}] ${violation.snippet}`
    );
  }
  process.exit(1);
}

console.log("[anon-guard] OK");
