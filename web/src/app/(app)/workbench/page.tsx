"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Search, Plus } from "lucide-react";
import { GlobalPartySelector } from "@/components/party/global-party-selector";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function WorkbenchEntryPage() {
  const router = useRouter();
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">거래처 통합 작업대</h1>
        <p className="text-muted-foreground">
          거래처를 선택하면 주문, 출고, 수금을 한 화면에서 처리할 수 있습니다
        </p>
      </div>

      <Card className="border-primary/10">
        <CardHeader>
          <h3 className="text-lg font-semibold">거래처 선택</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <GlobalPartySelector
            onPartySelect={(party) => setSelectedPartyId(party.party_id)}
            className="w-full"
          />

          <Button 
            className="w-full" 
            size="lg"
            disabled={!selectedPartyId}
            onClick={() => {
              if (selectedPartyId) {
                router.push(`/workbench/${selectedPartyId}`);
              }
            }}
          >
            작업대 열기
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">또는</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a href="/party" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors h-10 px-4 border border-border/60 bg-card text-foreground shadow-sm hover:bg-muted/40">
              <Plus className="w-4 h-4" />
              새 거래처
            </a>
            <a href="/orders" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors h-10 px-4 border border-border/60 bg-card text-foreground shadow-sm hover:bg-muted/40">
              <Search className="w-4 h-4" />
              빠른 주문
            </a>
          </div>
        </CardBody>
      </Card>

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="text-center p-4">
          <div className="text-2xl font-bold text-primary mb-1">통합</div>
          <div className="text-sm text-muted-foreground">주문·출고·수금<br/>한 화면에서</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl font-bold text-primary mb-1">빠름</div>
          <div className="text-sm text-muted-foreground">페이지 이동 없이<br/>업무 완료</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl font-bold text-primary mb-1">직관</div>
          <div className="text-sm text-muted-foreground">타임라인으로<br/>흐름 파악</div>
        </div>
      </div>
    </div>
  );
}
