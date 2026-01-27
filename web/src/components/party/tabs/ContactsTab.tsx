import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { PartyPersonLink } from "@/lib/api/cmsParty";

type ContactsTabProps = {
  links: PartyPersonLink[];
};

export function ContactsTab({ links }: ContactsTabProps) {
  return (
    <Card>
      <CardHeader>
        <ActionBar title="담당자 목록" />
      </CardHeader>
      <CardBody>
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          백엔드 RPC 필요 (v2 미구현)
        </div>
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.person_id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{link.person?.name || "-"}</span>
                  {link.is_primary && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                      대표
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {link.person?.phone || "-"} · {link.role || "-"}
                </p>
              </div>
            </div>
          ))}
          {links.length === 0 && (
            <p className="text-sm text-[var(--muted)]">등록된 담당자가 없습니다.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
