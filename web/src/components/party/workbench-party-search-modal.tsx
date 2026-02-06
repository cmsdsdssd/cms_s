"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { getSchemaClient } from "@/lib/supabase/client";

type Party = {
  party_id: string;
  name: string;
  party_type?: string;
  phone?: string;
  region?: string;
};

type WorkbenchPartySearchModalProps = {
  open: boolean;
  onClose: () => void;
};

type PartyMatch = Party & { matchIndex: number };

export function WorkbenchPartySearchModal({ open, onClose }: WorkbenchPartySearchModalProps) {
  const router = useRouter();
  const schemaClient = getSchemaClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setQuery("");
  }, [open]);

  const normalizedQuery = query.trim();

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["workbench-party-search", normalizedQuery],
    queryFn: async () => {
      if (!schemaClient || normalizedQuery.length === 0) return [] as Party[];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, phone, region")
        .ilike("name", `%${normalizedQuery}%`)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as Party[];
    },
    enabled: open && normalizedQuery.length > 0 && !!schemaClient,
  });

  const sortedResults = useMemo(() => {
    if (!normalizedQuery) return [] as PartyMatch[];
    const lowerQuery = normalizedQuery.toLowerCase();
    const matches = (searchResults ?? [])
      .map((party) => ({
        ...party,
        matchIndex: party.name.toLowerCase().indexOf(lowerQuery),
      }))
      .filter((party) => party.matchIndex >= 0);

    matches.sort((a, b) => {
      if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return a.name.localeCompare(b.name, "ko");
    });

    return matches;
  }, [normalizedQuery, searchResults]);

  const handleSelect = (party: Party) => {
    router.push(`/workbench/${party.party_id}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="거래처 선택" className="max-w-3xl">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="거래처 이름을 입력하세요"
            className="pl-9"
          />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--panel)]">
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">검색 중...</div>
            ) : normalizedQuery.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">거래처 이름을 입력하세요.</div>
            ) : sortedResults.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">검색 결과가 없습니다.</div>
            ) : (
              <div className="divide-y divide-[var(--hairline)]">
                {sortedResults.map((party) => (
                  <button
                    key={party.party_id}
                    type="button"
                    onClick={() => handleSelect(party)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                      "hover:bg-[var(--panel-hover)]"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--foreground)]">{party.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        {party.party_type ? <span>{party.party_type}</span> : null}
                        {party.phone ? <span>{party.phone}</span> : null}
                        {party.region ? <span>{party.region}</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
