import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { VendorPrefix } from "@/lib/api/cmsParty";

type PrefixMapTabProps = {
  prefixes: VendorPrefix[];
};

export function PrefixMapTab({ prefixes }: PrefixMapTabProps) {
  return (
    <Card>
      <CardHeader>
        <ActionBar title="Prefix Map" />
      </CardHeader>
      <CardBody>
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          백엔드 RPC 필요 (v2 미구현)
        </div>
        <div className="space-y-2">
          {prefixes.map((prefix) => (
            <div key={prefix.prefix} className="flex items-center justify-between rounded border p-3">
              <span className="font-mono font-bold">{prefix.prefix}</span>
              <span className="text-sm text-[var(--muted)]">{prefix.note}</span>
            </div>
          ))}
          {prefixes.length === 0 && (
            <p className="text-sm text-[var(--muted)]">등록된 Prefix가 없습니다.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
