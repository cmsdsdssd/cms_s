import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { PartyAddress } from "@/lib/api/cmsParty";

type AddressesTabProps = {
  addresses: PartyAddress[];
};

export function AddressesTab({ addresses }: AddressesTabProps) {
  return (
    <Card>
      <CardHeader>
        <ActionBar title="주소 목록" />
      </CardHeader>
      <CardBody>
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          백엔드 RPC 필요 (v2 미구현)
        </div>
        <div className="space-y-2">
          {addresses.map((addr) => (
            <div key={addr.address_id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{addr.label || "주소"}</span>
                  {addr.is_default && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                      기본
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--muted)]">{addr.address_text}</p>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-sm text-[var(--muted)]">등록된 주소가 없습니다.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
