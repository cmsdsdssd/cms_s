"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { TimelineEmpty } from "@/components/timeline/timeline-view";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";

type PartyOption = { party_id: string; name: string };

type RepairRow = {
  repair_line_id: string;
  customer_party_id?: string | null;
  received_at?: string | null;
  model_name?: string | null;
  status?: string | null;
  repair_fee_krw?: number | null;
  issue_desc?: string | null;
  memo?: string | null;
};

const statusBadge = (status?: string | null) => {
  const normalized = (status ?? "").trim();
  const map: Record<string, { label: string; tone: "neutral" | "active" | "warning" | "danger" }> = {
    RECEIVED: { label: "접수", tone: "warning" },
    IN_PROGRESS: { label: "진행", tone: "active" },
    READY_TO_SHIP: { label: "출고대기", tone: "active" },
    SHIPPED: { label: "출고완료", tone: "neutral" },
    CANCELLED: { label: "취소", tone: "danger" },
  };
  return map[normalized] ?? { label: normalized || "-", tone: "neutral" };
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString().slice(0, 10);
};

export function WorkbenchRepairsTab({ partyId }: { partyId: string }) {
  const schemaClient = getSchemaClient();
  const [selectedPartyId, setSelectedPartyId] = useState(partyId);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setSelectedPartyId(partyId);
  }, [partyId]);

  const partiesQuery = useQuery({
    queryKey: ["workbench-repairs-parties"],
    queryFn: async () => {
      if (!schemaClient) return [] as PartyOption[];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name")
        .eq("is_active", true)
        .eq("party_type", "customer")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PartyOption[];
    },
    enabled: !!schemaClient,
  });

  const repairsQuery = useQuery({
    queryKey: ["workbench-repairs", selectedPartyId, limit],
    queryFn: async () => {
      if (!schemaClient) return [] as RepairRow[];
      let query = schemaClient
        .from(CONTRACTS.views.repairLineEnriched)
        .select("repair_line_id, customer_party_id, received_at, model_name, status, repair_fee_krw, issue_desc, memo")
        .order("received_at", { ascending: false })
        .limit(limit);
      if (selectedPartyId) {
        query = query.eq("customer_party_id", selectedPartyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RepairRow[];
    },
    enabled: !!schemaClient,
  });

  const partyOptions = useMemo(
    () => (partiesQuery.data ?? []).filter((party) => party.party_id !== partyId),
    [partiesQuery.data, partyId]
  );
  const hasMore = (repairsQuery.data?.length ?? 0) >= limit;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedPartyId} onChange={(event) => setSelectedPartyId(event.target.value)}>
          <option value={partyId}>현재 거래처</option>
          <option value="">전체 거래처</option>
          {partyOptions.map((party) => (
            <option key={party.party_id} value={party.party_id}>
              {party.name}
            </option>
          ))}
        </Select>
      </div>

      {(repairsQuery.data ?? []).length > 0 ? (
        <div className="space-y-3">
          {(repairsQuery.data ?? []).map((row) => {
            const badge = statusBadge(row.status);
            return (
              <Card key={row.repair_line_id} className="hover:border-primary/30 transition-colors">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{row.model_name ?? "-"}</div>
                        <Badge tone={badge.tone} className="text-xs">
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(row.received_at)} · {row.issue_desc ?? row.memo ?? ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        ₩{Number(row.repair_fee_krw ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <TimelineEmpty message="수리 내역이 없습니다" />
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((prev) => prev + 50)}>
            더 보기
          </Button>
        </div>
      )}
    </div>
  );
}
