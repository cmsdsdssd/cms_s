"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Building2, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";

interface PartyDetail {
  party_id: string;
  name: string;
  party_type?: string;
  phone?: string;
  region?: string;
  note?: string;
}

type ArPositionRow = {
  receivable_krw?: number | null;
  credit_krw?: number | null;
  gold_outstanding_g?: number | null;
  silver_outstanding_g?: number | null;
  last_activity_at?: string | null;
};

type ArBalanceRow = {
  open_invoices_count?: number | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "MM/dd", { locale: ko });
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "0";
  return Math.round(value).toLocaleString();
};

const formatGram = (value?: number | null) => {
  if (value === null || value === undefined) return "0";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2,
  }).format(numeric);
};

export function PartyInfoCard({ partyId }: { partyId: string }) {
  const schemaClient = getSchemaClient();

  const { data: party } = useQuery({
    queryKey: ["party-detail", partyId],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, phone, region, note")
        .eq("party_id", partyId)
        .single();
      if (error) throw error;
      return data as PartyDetail;
    },
    enabled: !!schemaClient && !!partyId,
  });

  const { data: position } = useQuery({
    queryKey: ["party-position", partyId],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arPositionByParty)
        .select("receivable_krw, credit_krw, gold_outstanding_g, silver_outstanding_g, last_activity_at")
        .eq("party_id", partyId)
        .single();
      if (error) return null;
      return data as ArPositionRow;
    },
    enabled: !!schemaClient && !!partyId,
  });

  const { data: balance } = useQuery({
    queryKey: ["party-open-invoices", partyId],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arBalanceByParty)
        .select("open_invoices_count")
        .eq("party_id", partyId)
        .single();
      if (error) return null;
      return data as ArBalanceRow;
    },
    enabled: !!schemaClient && !!partyId,
  });

  if (!party) return null;

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{party.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {party.party_type && (
                  <Badge tone="neutral" className="text-xs">
                    {party.party_type}
                  </Badge>
                )}
                {party.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {party.phone}
                  </span>
                )}
                {party.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {party.region}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">미수(₩)</div>
            <div className="font-semibold">₩{formatKrw(position?.receivable_krw)}</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">선수(₩)</div>
            <div className="font-semibold">₩{formatKrw(position?.credit_krw)}</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">현물 미수</div>
            <div className="font-semibold">금 {formatGram(position?.gold_outstanding_g)}g</div>
            <div className="text-xs text-muted-foreground">은 {formatGram(position?.silver_outstanding_g)}g</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">미수건수</div>
            <div className="font-semibold">{balance?.open_invoices_count ?? 0}건</div>
            <div className="text-xs text-muted-foreground">최근활동 {formatDate(position?.last_activity_at)}</div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
