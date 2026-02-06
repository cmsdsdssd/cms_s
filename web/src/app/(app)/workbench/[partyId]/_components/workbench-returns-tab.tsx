"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { TimelineEmpty } from "@/components/timeline/timeline-view";
import { getSchemaClient } from "@/lib/supabase/client";

type PartyOption = { party_id: string; name: string };

type ReturnRow = {
  return_line_id: string;
  occurred_at?: string | null;
  final_return_amount_krw?: number | null;
  reason?: string | null;
  return_qty?: number | null;
  cms_shipment_line?: {
    model_name?: string | null;
    qty?: number | null;
  } | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString().slice(0, 10);
};

export function WorkbenchReturnsTab({ partyId }: { partyId: string }) {
  const schemaClient = getSchemaClient();
  const [selectedPartyId, setSelectedPartyId] = useState(partyId);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setSelectedPartyId(partyId);
  }, [partyId]);

  const partiesQuery = useQuery({
    queryKey: ["workbench-returns-parties"],
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

  const returnsQuery = useQuery({
    queryKey: ["workbench-returns", selectedPartyId, limit],
    queryFn: async () => {
      if (!schemaClient) return [] as ReturnRow[];
      let query = schemaClient
        .from("cms_return_line")
        .select(
          "return_line_id, occurred_at, final_return_amount_krw, reason, return_qty, cms_shipment_line!inner(model_name, qty, shipment_header:cms_shipment_header(customer_party_id))"
        )
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (selectedPartyId) {
        query = query.eq("cms_shipment_line.shipment_header.customer_party_id", selectedPartyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReturnRow[];
    },
    enabled: !!schemaClient,
  });

  const partyOptions = useMemo(
    () => (partiesQuery.data ?? []).filter((party) => party.party_id !== partyId),
    [partiesQuery.data, partyId]
  );
  const hasMore = (returnsQuery.data?.length ?? 0) >= limit;

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

      {(returnsQuery.data ?? []).length > 0 ? (
        <div className="space-y-3">
          {(returnsQuery.data ?? []).map((row) => {
            const modelName = row.cms_shipment_line?.model_name ?? "-";
            const qty = row.return_qty ?? 0;
            const amount = Number(row.final_return_amount_krw ?? 0);
            return (
              <Card key={row.return_line_id} className="hover:border-primary/30 transition-colors">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{modelName}</div>
                      <div className="text-sm text-muted-foreground">
                        {qty}개 · {formatDate(row.occurred_at)}
                      </div>
                      {row.reason && (
                        <div className="text-xs text-muted-foreground">{row.reason}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">₩{amount.toLocaleString()}</div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <TimelineEmpty message="반품 내역이 없습니다" />
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
