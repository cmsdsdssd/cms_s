"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  PackageCheck, 
  Weight,
  Coins,
  Palette,
  Calculator,
  Save,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { getSchemaClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { CONTRACTS } from "@/lib/contracts";

interface InlineShipmentPanelProps {
  orderLineId: string;
  orderData: {
    modelName: string;
    color: string;
    qty: number;
    customerPartyId: string;
    suffix?: string;
    size?: string;
  };
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface MasterInfo {
  master_id?: string;
  weight_default_g?: number;
  deduction_weight_default_g?: number;
  labor_base_sell?: number;
  labor_center_sell?: number;
  labor_sub1_sell?: number;
  labor_sub2_sell?: number;
  material_price?: number;
  category_code?: string;
}

interface MarketTick {
  gold_price?: number;
  silver_price?: number;
}

export function InlineShipmentPanel({
  orderLineId,
  orderData,
  onComplete,
  onCancel,
  className,
}: InlineShipmentPanelProps) {
  const queryClient = useQueryClient();
  const schemaClient = getSchemaClient();
  
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [step, setStep] = useState<"draft" | "pricing" | "confirm">("draft");
  
  // Form states
  const [weight, setWeight] = useState<string>("");
  const [deduction, setDeduction] = useState<string>("");
  const [platingCost, setPlatingCost] = useState<string>("0");
  const [repairFee, setRepairFee] = useState<string>("0");
  const [laborCost, setLaborCost] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Fetch master item info
  const { data: masterInfo } = useQuery({
    queryKey: ["master-lookup", orderData.modelName],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.masterItemLookup)
        .select("master_item_id, weight_default_g, deduction_weight_default_g, labor_basic, labor_center, labor_side1, labor_side2, material_price, category_code")
        .ilike("model_name", orderData.modelName)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as MasterInfo | null;
    },
    enabled: !!schemaClient && !!orderData.modelName,
  });

  // Fetch current market ticks
  const { data: marketTicks } = useQuery({
    queryKey: ["market-ticks"],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.marketLatestGoldSilverOps)
        .select("symbol, price")
        .in("symbol", ["GOLD_KRW_PER_G", "SILVER_KRW_PER_G"]);
      if (error) return null;
      const rows = data as Array<{ symbol: string; price: number }> | null;
      const gold = rows?.find(d => d.symbol === "GOLD_KRW_PER_G")?.price;
      const silver = rows?.find(d => d.symbol === "SILVER_KRW_PER_G")?.price;
      return { gold_price: gold, silver_price: silver } as MarketTick;
    },
    enabled: !!schemaClient,
  });

  // Initialize with defaults
  useEffect(() => {
    if (masterInfo) {
      if (!weight && masterInfo.weight_default_g) {
        setWeight(String(masterInfo.weight_default_g * orderData.qty));
      }
      if (!deduction && masterInfo.deduction_weight_default_g) {
        setDeduction(String(masterInfo.deduction_weight_default_g * orderData.qty));
      }
      // Calculate labor cost
      const totalLabor = 
        (masterInfo.labor_base_sell || 0) + 
        (masterInfo.labor_center_sell || 0) + 
        (masterInfo.labor_sub1_sell || 0) + 
        (masterInfo.labor_sub2_sell || 0);
      if (!laborCost && totalLabor > 0) {
        setLaborCost(String(totalLabor * orderData.qty));
      }
    }
  }, [masterInfo, orderData.qty]);

  // Calculate totals
  const weightNum = parseFloat(weight) || 0;
  const deductionNum = parseFloat(deduction) || 0;
  const netWeight = Math.max(0, weightNum - deductionNum);
  const goldPrice = marketTicks?.gold_price || 0;
  const materialCost = netWeight * (masterInfo?.material_price || goldPrice || 0);
  const laborTotal = parseFloat(laborCost) || 0;
  const platingTotal = parseFloat(platingCost) || 0;
  const repairTotal = parseFloat(repairFee) || 0;
  const totalAmount = materialCost + laborTotal + platingTotal + repairTotal;

  // Create shipment mutation
  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!schemaClient) throw new Error("No schema client");
      
      // Create shipment from order
      const result = await callRpc<{ shipment_id: string }>(
        CONTRACTS.functions.shipmentUpsertFromOrder,
        {
          p_order_line_id: orderLineId,
          p_customer_party_id: orderData.customerPartyId,
        }
      );
      
      return result;
    },
    onSuccess: (data) => {
      if (data?.shipment_id) {
        setShipmentId(data.shipment_id);
        setStep("pricing");
        toast.success("출고가 생성되었습니다");
      }
    },
    onError: (error) => {
      toast.error("출고 생성 실패", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  // Update shipment line mutation
  const updateLineMutation = useMutation({
    mutationFn: async () => {
      if (!shipmentId || !schemaClient) throw new Error("No shipment");
      
      // Update shipment line with weights and pricing
      await callRpc("cms_fn_shipment_update_line_v1", {
        p_shipment_id: shipmentId,
        p_measured_weight_g: weightNum / orderData.qty, // per unit
        p_deduction_weight_g: deductionNum / orderData.qty, // per unit
        p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
        p_repair_fee_krw: parseFloat(repairFee) || 0,
        p_pricing_mode: "RULE",
      });
      
      return true;
    },
    onSuccess: () => {
      setStep("confirm");
      toast.success("출고 정보가 저장되었습니다");
    },
    onError: (error) => {
      toast.error("저장 실패", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  // Confirm shipment mutation
  const confirmShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!shipmentId) throw new Error("No shipment");
      
      const result = await callRpc<{ ok: boolean; total_sell_krw: number }>(
        CONTRACTS.functions.shipmentConfirm,
        {
          p_shipment_id: shipmentId,
          p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID || null,
        }
      );
      
      return result;
    },
    onSuccess: (data) => {
      toast.success("출고가 확정되었습니다", {
        description: `총액: ₩${data?.total_sell_krw?.toLocaleString()}`,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["order-worklist"] });
      queryClient.invalidateQueries({ queryKey: ["ar-balance"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      toast.error("출고 확정 실패", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const handleStart = () => {
    createShipmentMutation.mutate();
  };

  const handleSave = () => {
    updateLineMutation.mutate();
  };

  const handleConfirm = () => {
    confirmShipmentMutation.mutate();
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <PackageCheck className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">출고 처리</h4>
            <p className="text-xs text-muted-foreground">
              {orderData.modelName} × {orderData.qty}개
            </p>
          </div>
        </div>
        
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {step === "draft" && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              주문 #{orderLineId.slice(0, 8)}에 대한 출고를 시작합니다
            </p>
            <Button 
              onClick={handleStart}
              disabled={createShipmentMutation.isPending}
            >
              {createShipmentMutation.isPending ? "처리 중..." : "출고 시작"}
            </Button>
          </div>
        )}

        {step === "pricing" && (
          <div className="space-y-4">
            {/* Weight Section */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Weight className="w-4 h-4" />
                중량 정보
              </h5>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    총 중량 (g)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    차감 중량 (g)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={deduction}
                    onChange={(e) => setDeduction(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    순 중량 (g)
                  </label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                    {netWeight.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Section */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Coins className="w-4 h-4" />
                금액 정보
              </h5>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    도금 비용 (₩)
                  </label>
                  <Input
                    type="number"
                    value={platingCost}
                    onChange={(e) => setPlatingCost(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    수리 비용 (₩)
                  </label>
                  <Input
                    type="number"
                    value={repairFee}
                    onChange={(e) => setRepairFee(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  공임 (₩) - 자동계산 또는 수동입력
                </label>
                <Input
                  type="number"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Price Preview */}
            <div className="bg-muted rounded-lg p-3 space-y-2">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                예상 금액
              </h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>재료비 ({netWeight.toFixed(2)}g)</span>
                  <span>₩{Math.round(materialCost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>공임</span>
                  <span>₩{Math.round(laborTotal).toLocaleString()}</span>
                </div>
                {platingTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>도금</span>
                    <span>₩{Math.round(platingTotal).toLocaleString()}</span>
                  </div>
                )}
                {repairTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>수리</span>
                    <span>₩{Math.round(repairTotal).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-foreground pt-2 border-t border-border">
                  <span>합계</span>
                  <span>₩{Math.round(totalAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setStep("draft")}
                className="flex-1"
              >
                이전
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateLineMutation.isPending || !weight}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateLineMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">출고 준비 완료</span>
              </div>
              <p className="text-sm text-green-600">
                총액 ₩{Math.round(totalAmount).toLocaleString()}원을 확정하시겠습니까?
              </p>
              <p className="text-xs text-green-500 mt-1">
                확정 시 재고가 차감되고 미수금이 생성됩니다.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setStep("pricing")}
                className="flex-1"
              >
                수정
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmShipmentMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {confirmShipmentMutation.isPending ? "확정 중..." : "출고 확정"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
