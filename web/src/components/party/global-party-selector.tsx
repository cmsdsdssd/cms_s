"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Building2, ChevronDown, Phone, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Party {
  party_id: string;
  name: string;
  party_type?: string;
  phone?: string;
  region?: string;
  balance_krw?: number;
  last_tx_at?: string;
}

interface GlobalPartySelectorProps {
  currentPartyId?: string | null;
  onPartySelect?: (party: Party) => void;
  className?: string;
  showBalance?: boolean;
}

export function GlobalPartySelector({
  currentPartyId,
  onPartySelect,
  className,
  showBalance = true,
}: GlobalPartySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const schemaClient = getSchemaClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load current party info
  const { data: currentPartyData } = useQuery({
    queryKey: ["party", currentPartyId],
    queryFn: async () => {
      if (!currentPartyId || !schemaClient) return null;
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, phone, region")
        .eq("party_id", currentPartyId)
        .single();
      if (error) throw error;
      return data as Party;
    },
    enabled: !!currentPartyId && !!schemaClient,
  });

  // Load balance info
  const { data: balanceData } = useQuery({
    queryKey: ["party-balance", currentPartyId],
    queryFn: async () => {
      if (!currentPartyId || !schemaClient) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arBalanceByParty)
        .select("balance_krw")
        .eq("party_id", currentPartyId)
        .single();
      if (error) return null;
      return data as { balance_krw: number };
    },
    enabled: !!currentPartyId && !!schemaClient && showBalance,
  });

  // Search parties
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["party-search", searchQuery],
    queryFn: async () => {
      if (!schemaClient || searchQuery.length < 1) return [];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, phone, region")
        .ilike("name", `%${searchQuery}%`)
        .eq("is_active", true)
        .limit(10);
      if (error) throw error;
      return data as Party[];
    },
    enabled: !!schemaClient && isOpen,
  });

  // Update selected party when currentPartyId changes
  useEffect(() => {
    if (currentPartyData) {
      setSelectedParty({
        ...currentPartyData,
        balance_krw: balanceData?.balance_krw,
      });
    }
  }, [currentPartyData, balanceData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handlePartySelect = useCallback((party: Party) => {
    setSelectedParty(party);
    setIsOpen(false);
    setSearchQuery("");
    
    if (onPartySelect) {
      onPartySelect(party);
    } else {
      // Default: navigate to workbench
      router.push(`/workbench/${party.party_id}`);
    }
  }, [onPartySelect, router]);

  const handleClear = useCallback(() => {
    setSelectedParty(null);
    setSearchQuery("");
    if (onPartySelect) {
      onPartySelect(null as unknown as Party);
    }
  }, [onPartySelect]);

  const formatBalance = (balance?: number) => {
    if (balance === undefined || balance === null) return "";
    const sign = balance > 0 ? "미수" : balance < 0 ? "선수" : "";
    const absBalance = Math.abs(balance);
    return `${sign} ₩${absBalance.toLocaleString()}`;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "flex items-center gap-3 w-full max-w-md px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
          "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20",
          selectedParty
            ? "bg-primary/5 border-primary/20"
            : "bg-card border-border hover:border-primary/30"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
          selectedParty ? "bg-primary/10" : "bg-muted"
        )}>
          <Building2 className={cn(
            "w-5 h-5",
            selectedParty ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        
        <div className="flex-1 min-w-0 text-left">
          {selectedParty ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate">
                  {selectedParty.name}
                </span>
                {showBalance && selectedParty.balance_krw !== undefined && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                    (selectedParty.balance_krw || 0) > 0
                      ? "bg-orange-100 text-orange-700"
                      : (selectedParty.balance_krw || 0) < 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  )}>
                    {formatBalance(selectedParty.balance_krw)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {selectedParty.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {selectedParty.phone}
                  </span>
                )}
                {selectedParty.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedParty.region}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">거래처를 선택하세요...</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {selectedParty && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="거래처명으로 검색..."
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                검색 중...
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.map((party) => (
                  <button
                    key={party.party_id}
                    onClick={() => handlePartySelect(party)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left hover:bg-muted transition-colors",
                      selectedParty?.party_id === party.party_id && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{party.name}</span>
                      {party.party_type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {party.party_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {party.phone && <span>{party.phone}</span>}
                      {party.region && <span>{party.region}</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery.length > 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                거래처명을 입력하세요
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-muted/50">
            <button
              onClick={() => {
                router.push("/party");
                setIsOpen(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              + 새 거래처 등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
