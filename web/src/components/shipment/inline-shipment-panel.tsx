"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck,
  Weight,
  Coins,
  Calculator,
  Save,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
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

type ShipmentLineRow = {
  shipment_line_id?: string;
  material_amount_sell_krw?: number | null;
};

type ShipmentLineUpdate = {
  manual_labor_krw?: number;
  labor_total_sell_krw?: number;
  total_amount_sell_krw?: number;
  actual_labor_cost_krw?: number;
  actual_cost_krw?: number;
};

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
  const [isStorePickup, setIsStorePickup] = useState(false);
  
  // Form states
  const [weight, setWeight] = useState<string>("");
  const [deduction, setDeduction] = useState<string>("");
  const [platingCost, setPlatingCost] = useState<string>("0");
  const [repairFee, setRepairFee] = useState<string>("0");
  const [laborCost, setLaborCost] = useState<string>("");
  const [hasEditedWeight, setHasEditedWeight] = useState(false);
  const [hasEditedDeduction, setHasEditedDeduction] = useState(false);
  const [hasEditedLaborCost, setHasEditedLaborCost] = useState(false);

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

  const defaultWeight = masterInfo?.weight_default_g
    ? String(masterInfo.weight_default_g * orderData.qty)
    : "";
  const defaultDeduction = masterInfo?.deduction_weight_default_g
    ? String(masterInfo.deduction_weight_default_g * orderData.qty)
    : "";
  const defaultLaborCost = masterInfo
    ? String(
      (
        (masterInfo.labor_base_sell || 0) +
        (masterInfo.labor_center_sell || 0) +
        (masterInfo.labor_sub1_sell || 0) +
        (masterInfo.labor_sub2_sell || 0)
      ) * orderData.qty
    )
    : "";

  // Calculate totals
  const resolvedWeight = hasEditedWeight ? weight : defaultWeight;
  const resolvedDeduction = hasEditedDeduction ? deduction : defaultDeduction;
  const resolvedLaborCost = hasEditedLaborCost ? laborCost : defaultLaborCost;

  const weightNum = parseFloat(resolvedWeight) || 0;
  const deductionNum = parseFloat(resolvedDeduction) || 0;
  const netWeight = Math.max(0, weightNum - deductionNum);
  const goldPrice = marketTicks?.gold_price || 0;
  const materialCost = netWeight * (masterInfo?.material_price || goldPrice || 0);
  const laborTotal = parseFloat(resolvedLaborCost) || 0;
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
      // ✅ 총액 직접 계산 (소재비 + 공임 + 도금 + 수리비)
      const calculatedTotal = materialCost + laborTotal + platingTotal + repairTotal;
      
      await callRpc("cms_fn_shipment_update_line_v1", {
        p_shipment_id: shipmentId,
        p_measured_weight_g: weightNum / orderData.qty, // per unit
        p_deduction_weight_g: deductionNum / orderData.qty, // per unit
        p_plating_amount_sell_krw: parseFloat(platingCost) || 0,
        p_repair_fee_krw: parseFloat(repairFee) || 0,
        p_manual_total_amount_krw: calculatedTotal,
        p_pricing_mode: "RULE",
      });
      
      // ✅ 공임 직접 업데이트 (DB 함수가 labor 컬럼을 업데이트하지 않는 문제 해결)
      const { data: lineDataRaw } = await schemaClient
        .from('cms_shipment_line')
        .select('shipment_line_id, material_amount_sell_krw')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lineData = (lineDataRaw ?? null) as ShipmentLineRow | null;
      
      if (lineData?.shipment_line_id && laborTotal > 0) {
        const materialCostFromDb = lineData.material_amount_sell_krw || materialCost;
        const newTotal = materialCostFromDb + laborTotal;

        const shipmentLineTable = schemaClient.from('cms_shipment_line') as unknown as {
          update: (values: ShipmentLineUpdate) => { eq: (column: string, value: string) => Promise<unknown> };
        };

        await shipmentLineTable
          .update({ 
            manual_labor_krw: laborTotal,
            labor_total_sell_krw: laborTotal,
            total_amount_sell_krw: newTotal,
            actual_labor_cost_krw: laborTotal,
            actual_cost_krw: newTotal
          })
          .eq('shipment_line_id', lineData.shipment_line_id);
          
        console.log('[Inline Panel Labor Update] labor:', laborTotal, 'total:', newTotal);
      }
      
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

      const actorId = process.env.NEXT_PUBLIC_CMS_ACTOR_ID || null;

      if (isStorePickup) {
        await callRpc(CONTRACTS.functions.shipmentSetStorePickup, {
          p_shipment_id: shipmentId,
          p_is_store_pickup: true,
          p_actor_person_id: actorId,
          p_note: "set from inline shipment",
        });

        return { ok: true, total_sell_krw: Math.round(totalAmount) };
      }

      return callRpc<{ ok: boolean; total_sell_krw: number }>(
        CONTRACTS.functions.shipmentConfirm,
        {
          p_shipment_id: shipmentId,
          p_actor_person_id: actorId,
        }
      );
    },
    onSuccess: (data) => {
      if (isStorePickup) {
        toast.success("매장출고로 저장됨", {
          description: "확정은 Workbench(당일출고)에서 진행하세요.",
        });
      } else {
        toast.success("출고가 확정되었습니다", {
          description: `총액: ₩${data?.total_sell_krw?.toLocaleString()}`,
        });
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["order-worklist"] });
      queryClient.invalidateQueries({ queryKey: ["ar-balance"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      const message = isStorePickup ? "매장출고 저장 실패" : "출고 확정 실패";
      toast.error(message, {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const handleStart = () => {
    createShipmentMutation.mutate();
  };

  const handleSave = () => {
    if (!hasEditedWeight && defaultWeight) {
      setWeight(defaultWeight);
      setHasEditedWeight(true);
    }
    if (!hasEditedDeduction && defaultDeduction) {
      setDeduction(defaultDeduction);
      setHasEditedDeduction(true);
    }
    if (!hasEditedLaborCost && defaultLaborCost) {
      setLaborCost(defaultLaborCost);
      setHasEditedLaborCost(true);
    }
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
                    value={resolvedWeight}
                    onChange={(e) => {
                      setHasEditedWeight(true);
                      setWeight(e.target.value);
                    }}
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
                    value={resolvedDeduction}
                    onChange={(e) => {
                      setHasEditedDeduction(true);
                      setDeduction(e.target.value);
                    }}
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
                  value={resolvedLaborCost}
                  onChange={(e) => {
                    setHasEditedLaborCost(true);
                    setLaborCost(e.target.value);
                  }}
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

            <label className="inline-flex items-center gap-2 text-sm font-semibold text-green-700">
              <input
                type="checkbox"
                checked={isStorePickup}
                onChange={(event) => setIsStorePickup(event.target.checked)}
                className="h-4 w-4"
              />
              매장출고
            </label>

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
                {confirmShipmentMutation.isPending
                  ? isStorePickup
                    ? "저장 중..."
                    : "확정 중..."
                  : isStorePickup
                    ? "매장출고 저장 (워크벤치에서 확정)"
                    : "출고 확정"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
