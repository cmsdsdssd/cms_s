"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CONTRACTS } from "@/lib/contracts";
import { callRpc } from "@/lib/supabase/rpc";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Printer, Send, X, CheckCircle2, ArrowRight, ArrowLeft, 
  Building2, Factory, FileText 
} from "lucide-react";

// Types
interface OrderLine {
  order_line_id?: string;
  customer_party_id?: string;
  customer_name?: string;
  customer_mask_code?: string;  // Added for factory PO masking
  model_name?: string;
  suffix?: string;
  color?: string;
  size?: string | null;
  qty?: number;
  memo?: string | null;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  center_stone_name?: string | null;
  center_stone_qty?: number | null;
  sub1_stone_name?: string | null;
  sub1_stone_qty?: number | null;
  sub2_stone_name?: string | null;
  sub2_stone_qty?: number | null;
  vendor_guess_id?: string;
  vendor_guess?: string;
  status?: string;
  factory_po_id?: string | null;
}

interface FactoryGroup {
  prefix: string;
  vendorPartyId: string;
  vendorName: string;
  lines: OrderLine[];
  faxNumber?: string;
  faxProvider?: 'mock' | 'twilio' | 'sendpulse' | 'etan' | 'efax';
}

type WizardStep = 'select' | 'preview' | 'confirm';

interface FactoryOrderWizardProps {
  orderLines: OrderLine[];
  onClose: () => void;
  onSuccess?: () => void;
}

// Color chip helper
function ColorChip({ color }: { color: string }) {
  const colors: Record<string, string> = {
    'P': 'bg-rose-400',
    'G': 'bg-amber-400', 
    'W': 'bg-slate-300',
    'B': 'bg-gray-800',
  };
  
  return (
    <span className={cn(
      "inline-block w-4 h-4 rounded-sm border border-black/20",
      colors[color] || "bg-gray-400"
    )} />
  );
}

// Parse color string into array
function parseColors(colorStr: string | null | undefined): string[] {
  if (!colorStr) return [];
  return colorStr.split('+').filter(Boolean);
}

export function FactoryOrderWizard({ orderLines, onClose, onSuccess }: FactoryOrderWizardProps) {
  const queryClient = useQueryClient();
  const schemaClient = getSchemaClient();
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean; 
    count: number; 
    results?: {group: FactoryGroup; poId: string; success: boolean}[]
  } | null>(null);

  // Fetch vendor fax configs from DB
  const faxConfigsQuery = useQuery({
    queryKey: ["cms_vendor_fax_configs_wizard"],
    queryFn: async () => {
      if (!schemaClient) return [];
      const { data, error } = await schemaClient
        .from("cms_vendor_fax_config")
        .select("vendor_party_id, fax_number, fax_provider, is_active");
      
      if (error) {
        console.error('Failed to load fax configs:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!schemaClient,
  });

  // Create a map for quick lookup
  const faxConfigMap = useMemo(() => {
    const map = new Map<string, { fax_number: string | null; fax_provider: string }>();
    faxConfigsQuery.data?.forEach(config => {
      if (config.is_active !== false) {
        map.set(config.vendor_party_id, {
          fax_number: config.fax_number,
          fax_provider: config.fax_provider || 'mock',
        });
      }
    });
    return map;
  }, [faxConfigsQuery.data]);

  // Filter eligible orders (ORDER_PENDING, no PO, has vendor)
  const eligibleOrders = useMemo(() => {
    return orderLines.filter(order => 
      order.status === 'ORDER_PENDING' && 
      !order.factory_po_id &&
      order.vendor_guess_id
    );
  }, [orderLines]);

  console.log('=== Wizard received orderLines ===', orderLines.length);
  console.log('Sample order:', orderLines[0]);
  console.log('Eligible orders:', eligibleOrders.length, eligibleOrders.map(o => o.model_name));

  // Group by factory prefix and merge with fax config
  const factoryGroups = useMemo((): FactoryGroup[] => {
    const groups = new Map<string, FactoryGroup>();
    
    eligibleOrders.forEach(order => {
      const prefix = order.model_name?.split('-')[0]?.toUpperCase() || 'UNKNOWN';
      const key = `${prefix}_${order.vendor_guess_id}`;
      
      if (!groups.has(key)) {
        const vendorPartyId = order.vendor_guess_id || '';
        const faxConfig = faxConfigMap.get(vendorPartyId);
        
        groups.set(key, {
          prefix,
          vendorPartyId,
          vendorName: order.vendor_guess || 'Unknown',
          lines: [],
          faxNumber: faxConfig?.fax_number,
          faxProvider: (faxConfig?.fax_provider as any) || 'mock',
        });
      }
      
      groups.get(key)!.lines.push(order);
    });
    
    return Array.from(groups.values()).sort((a, b) => a.prefix.localeCompare(b.prefix));
  }, [eligibleOrders, faxConfigMap]);

  console.log('Factory groups:', factoryGroups.map(g => `${g.prefix}(${g.lines.length})`));

  // Selected groups
  const selectedGroups = useMemo(() => {
    return factoryGroups.filter(g => selectedPrefixes.has(g.prefix));
  }, [factoryGroups, selectedPrefixes]);

  // All lines from selected factories
  const selectedLines = useMemo(() => {
    return selectedGroups.flatMap(g => g.lines);
  }, [selectedGroups]);

  // Toggle factory selection
  const toggleFactory = useCallback((prefix: string) => {
    setSelectedPrefixes(prev => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }, []);

  // Select all factories
  const selectAll = useCallback(() => {
    setSelectedPrefixes(new Set(factoryGroups.map(g => g.prefix)));
  }, [factoryGroups]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPrefixes(new Set());
  }, []);

  // Generate fax HTML for a SPECIFIC factory group (NOT combined)
  const generateFaxHtmlForGroup = useCallback((group: FactoryGroup): string => {
    const today = new Date().toLocaleDateString('ko-KR');
    const lines = group.lines;
    
    // Use random mask code from order_line (saved in DB)
    const getMaskCode = (line: OrderLine) => line.customer_mask_code || 'UNKNOWN';
    
    const rowsHtml = lines.map((line, idx) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px; text-align: center; font-size: 10px;">${idx + 1}</td>
        <td style="padding: 6px; font-size: 9px; font-family: monospace;">${getMaskCode(line)}</td>
        <td style="padding: 6px; font-size: 11px;">${line.model_name || '-'}</td>
        <td style="padding: 6px; text-align: center; font-size: 10px;">${line.suffix || '-'}</td>
        <td style="padding: 6px; text-align: center; font-size: 10px;">${line.color || '-'}</td>
        <td style="padding: 6px; text-align: center; font-size: 9px;">${line.is_plated ? '14K' : 'SV'}</td>
        <td style="padding: 6px; text-align: center; font-size: 10px;">${line.size || '-'}</td>
        <td style="padding: 6px; text-align: center; font-size: 10px;">${line.qty || 1}</td>
        <td style="padding: 6px; text-align: center; font-size: 9px;">${line.is_plated ? (line.plating_color_code || 'Y') : 'N'}</td>
        <td style="padding: 6px; font-size: 9px;">${line.memo || ''}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>발주서 - ${group.prefix}</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin: 0; }
    .info { margin-bottom: 20px; }
    .info-row { display: flex; margin-bottom: 5px; }
    .info-label { width: 100px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f0f0f0; padding: 8px; border-top: 2px solid #333; border-bottom: 1px solid #333; }
    td { padding: 8px; }
    .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; }
    .fax-info { margin-top: 20px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="header">
    <h1>발 주 서</h1>
    <p style="font-size: 12px; color: #666;">Order Date: ${today}</p>
    <p style="font-size: 11px; color: #999;">Vendor: ${group.vendorName} (${group.prefix})</p>
  </div>
  
  <div class="info">
    <div class="info-row">
      <span class="info-label">공장:</span>
      <span>${group.vendorName} (${group.prefix})</span>
    </div>
    <div class="info-row">
      <span class="info-label">총 라인:</span>
      <span>${lines.length}건 / ${lines.reduce((sum, l) => sum + (l.qty || 1), 0)}수량</span>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th style="width: 60px; font-size: 10px;">거래처</th>
        <th style="width: 90px;">모델</th>
        <th style="width: 35px; font-size: 10px;">Suffix</th>
        <th style="width: 45px;">색상</th>
        <th style="width: 35px; font-size: 10px;">소재</th>
        <th style="width: 35px;">Size</th>
        <th style="width: 30px;">수량</th>
        <th style="width: 35px; font-size: 10px;">도금</th>
        <th style="font-size: 10px;">비고</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  
  <div class="fax-info">
    <p style="font-size: 10px; margin: 0;"><strong>Fax Transmission:</strong> ${group.faxNumber || 'Not configured'}</p>
    <p style="font-size: 9px; margin: 2px 0 0 0; color: #666;">Provider: ${group.faxProvider || 'mock'}</p>
  </div>
  
  <div class="footer">
    <p>이 발주서는 전산시스템에서 자동 생성되었습니다.</p>
    <p>문의사항 있으시면 연락 바랍니다.</p>
  </div>
</body>
</html>
    `;
  }, []);

  // Handle print - Print ALL selected factories (separate pages)
  const handlePrint = useCallback(() => {
    if (selectedGroups.length === 0) return;
    
    // Generate combined HTML with page breaks between factories
    const pageBreak = '<div style="page-break-after: always;"></div>';
    const allFactoriesHtml = selectedGroups.map(group => generateFaxHtmlForGroup(group)).join(pageBreak);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(allFactoriesHtml);
      printWindow.document.close();
      printWindow.print();
    }
  }, [selectedGroups, generateFaxHtmlForGroup]);

  // Handle send fax - SEPARATE PO for each factory
  const handleSendFax = useCallback(async () => {
    if (selectedGroups.length === 0) return;
    
    setIsSending(true);
    
    try {
      // Process EACH factory group SEPARATELY (each gets their own PO and fax)
      let totalSuccess = 0;
      const results: {group: FactoryGroup, poId: string, success: boolean}[] = [];
      
      for (const group of selectedGroups) {
        const lineIds = group.lines.map(l => l.order_line_id);
        
        toast.info(`${group.vendorName} 발주 생성 중...`);
        
        // 1. Create PO for THIS factory only
        const createResult = await callRpc(CONTRACTS.functions.factoryPoCreate, {
          p_order_line_ids: lineIds,
          p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
        });
        
        if (!createResult?.ok) {
          console.error('PO creation failed for', group.prefix, createResult);
          toast.error(`${group.vendorName} 발주 생성 실패`);
          continue;
        }
        
        const poId = createResult.pos?.[0]?.po_id;
        if (!poId) {
          toast.error(`${group.vendorName} PO ID 없음`);
          continue;
        }
        
        // 2. Generate SEPARATE fax HTML for THIS factory only
        const html = generateFaxHtmlForGroup(group);
        
        toast.info(`${group.vendorName} 팩스 전송 중 (${group.faxNumber || '번호 미설정'})...`);
        
        // 3. Send fax for THIS factory
        const response = await fetch('/api/fax-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            po_id: poId,
            vendor_prefix: group.prefix,
            html_content: html,
            fax_number: group.faxNumber,
            provider: group.faxProvider || 'mock',
          }),
        });

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          const text = await response.text();
          console.error('Fax send failed - non-JSON response:', text.substring(0, 200));
          toast.error(`${group.vendorName} 팩스 전송 실패 (서버 오류: ${response.status})`);
          // Cancel PO on fax failure to allow retry
          try {
            console.log(`Attempting to cancel PO ${poId}...`);
            const cancelResult = await callRpc(CONTRACTS.functions.factoryPoCancel, {
              p_po_id: poId,
              p_reason: `Fax failed: ${response.status}`,
              p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
            });
            console.log(`PO ${poId} cancelled successfully:`, cancelResult);
            toast.info(`${group.vendorName} PO 취소 완료 (재발주 가능)`);
          } catch (cancelError) {
            console.error(`Failed to cancel PO ${poId}:`, cancelError);
            toast.error(`${group.vendorName} PO 취소 실패 - 수동으로 PO ${poId.slice(0,8)}... 취소 필요`);
          }
          results.push({group, poId, success: false});
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          console.error('Fax send failed:', error);
          toast.error(`${group.vendorName} 팩스 전송 실패: ${error.error || 'Unknown error'}`);
          // Cancel PO on fax failure to allow retry
          try {
            await callRpc(CONTRACTS.functions.factoryPoCancel, {
              p_po_id: poId,
              p_reason: `Fax failed: ${error.error}`,
              p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
            });
            console.log(`PO ${poId} cancelled after fax failure`);
          } catch (cancelError) {
            console.error(`Failed to cancel PO ${poId}:`, cancelError);
            toast.error(`${group.vendorName} PO 취소도 실패 - 수동 확인 필요`);
          }
          results.push({group, poId, success: false});
          continue;
        }

        const faxResult = await response.json();
        console.log(`Fax sent to ${group.vendorName}:`, faxResult);
        
        // Check for RPC errors (status not updated)
        if (faxResult.warning || faxResult.rpc_error) {
          console.error(`PO marked sent but status update failed for ${group.vendorName}:`, faxResult.rpc_error);
          toast.warning(`${group.vendorName} 팩스는 전송됐으나 상태 업데이트 실패. 수동 확인 필요.`);
          results.push({group, poId, success: true, warning: faxResult.warning || faxResult.rpc_error});
        } else {
          totalSuccess += group.lines.length;
          results.push({group, poId, success: true});
          toast.success(`${group.vendorName} 발주 및 팩스 전송 완료`);
        }
      }
      
      setSendResult({ success: true, count: totalSuccess, results });
      setStep('confirm');
      queryClient.invalidateQueries({ queryKey: ["cms", "orders"] });
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (failCount > 0) {
        toast.warning(`${successCount}개 공장 성공, ${failCount}개 실패`);
      } else {
        toast.success(`${successCount}개 공장 모두 발주 완료!`);
      }
      
    } catch (error) {
      console.error('Send fax error:', error);
      toast.error("팩스 전송 중 오류 발생");
    } finally {
      setIsSending(false);
    }
  }, [selectedGroups, generateFaxHtmlForGroup, queryClient]);

  // Render Step 1: Factory Selection
  const renderStepSelect = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          공장 선택
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            전체 선택
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            해제
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {factoryGroups.map((group) => {
          const isSelected = selectedPrefixes.has(group.prefix);
          const hasFax = !!group.faxNumber;
          return (
            <div
              key={group.prefix}
              onClick={() => toggleFactory(group.prefix)}
              className={cn(
                "p-4 rounded-lg border-2 cursor-pointer transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5",
                  isSelected ? "border-primary bg-primary text-white" : "border-muted"
                )}>
                  {isSelected && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">{group.vendorName}</div>
                  <div className="text-sm text-muted">코드: {group.prefix}</div>
                  <div className="text-sm mt-2">
                    <Badge variant="secondary">{group.lines.length}건</Badge>
                    <span className="ml-2 text-muted">
                      {group.lines.reduce((sum, l) => sum + (l.qty || 1), 0)}수량
                    </span>
                  </div>
                  {/* Fax Config Status */}
                  <div className="mt-2 text-xs">
                    {hasFax ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        팩스: {group.faxNumber} ({group.faxProvider || 'mock'})
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        팩스 번호 미설정 (mock 모드로 전송)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {factoryGroups.length === 0 && (
        <div className="text-center py-12 text-muted">
          <Factory className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>발주 가능한 공장이 없습니다.</p>
          <p className="text-sm mt-2">ORDER_PENDING 상태의 주문만 표시됩니다.</p>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button
          size="lg"
          disabled={selectedPrefixes.size === 0}
          onClick={() => setStep('preview')}
          className="flex items-center gap-2"
        >
          다음
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // Render Step 2: Preview
  const renderStepPreview = () => (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          팩스 미리보기
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            인쇄
          </Button>
        </div>
      </div>

      {/* Selected Factories Summary */}
      <div className="flex flex-wrap gap-2">
        {selectedGroups.map(group => (
          <Badge key={group.prefix} variant="outline" className="px-3 py-1">
            {group.vendorName} ({group.prefix}): {group.lines.length}건
          </Badge>
        ))}
      </div>

      {/* Preview Document */}
      <div className="flex-1 bg-white text-black p-8 overflow-auto border rounded-lg shadow-inner">
        <div 
          className="max-w-[210mm] mx-auto min-h-[297mm] bg-white p-8"
          style={{ fontFamily: "'Malgun Gothic', sans-serif" }}
        >
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-bold">발 주 서</h1>
            <p className="text-xs text-gray-500 mt-1">
              Order Date: {new Date().toLocaleDateString('ko-KR')}
            </p>
          </div>

          <div className="mb-6 space-y-1 text-sm">
            <div className="flex">
              <span className="w-24 font-bold">공장:</span>
              <span>{selectedGroups.map(g => `${g.vendorName}(${g.prefix})`).join(', ')}</span>
            </div>
            <div className="flex">
              <span className="w-24 font-bold">총 라인:</span>
              <span>{selectedLines.length}건 / {selectedLines.reduce((sum, l) => sum + (l.qty || 1), 0)}수량</span>
            </div>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-t-2 border-b border-black bg-gray-100">
                <th className="py-1 px-1 w-8 text-[10px]">#</th>
                <th className="py-1 px-1 text-left text-[10px] w-16">거래처</th>
                <th className="py-1 px-1 text-left">모델</th>
                <th className="py-1 px-1 w-12 text-[10px]">Suffix</th>
                <th className="py-1 px-1 w-14">색상</th>
                <th className="py-1 px-1 w-10 text-[10px]">소재</th>
                <th className="py-1 px-1 w-10">Size</th>
                <th className="py-1 px-1 w-8">수량</th>
                <th className="py-1 px-1 w-10 text-[10px]">도금</th>
                <th className="py-1 px-1 text-left text-[10px]">비고</th>
              </tr>
            </thead>
            <tbody>
              {selectedLines.map((line, idx) => (
                <tr key={line.order_line_id} className="border-b border-gray-200">
                  <td className="py-1 px-1 text-center text-[10px]">{idx + 1}</td>
                  <td className="py-1 px-1 text-[9px] font-mono">{line.customer_mask_code || 'TEMP'}</td>
                  <td className="py-1 px-1 font-medium">{line.model_name || '-'}</td>
                  <td className="py-1 px-1 text-center text-[10px]">{line.suffix || '-'}</td>
                  <td className="py-1 px-1 text-center">
                    <div className="flex justify-center gap-0.5">
                      {parseColors(line.color).map((c, i) => (
                        <span key={i} className={cn(
                          "inline-block w-3 h-3 rounded-sm border border-black/20",
                          c === 'P' ? 'bg-rose-400' :
                          c === 'G' ? 'bg-amber-400' :
                          c === 'W' ? 'bg-slate-300' :
                          c === 'B' ? 'bg-gray-800' : 'bg-gray-400'
                        )} />
                      ))}
                    </div>
                  </td>
                  <td className="py-1 px-1 text-center text-[9px]">{line.is_plated ? '14K' : 'SV'}</td>
                  <td className="py-1 px-1 text-center text-[10px]">{line.size || '-'}</td>
                  <td className="py-1 px-1 text-center font-semibold">{line.qty || 1}</td>
                  <td className="py-1 px-1 text-center">
                    <div className="flex justify-center gap-0.5">
                      {parseColors(line.plating_color_code).map((c, i) => (
                        <span key={i} className={cn(
                          "inline-block w-3 h-3 rounded-sm border border-black/20",
                          c === 'P' ? 'bg-rose-400' :
                          c === 'G' ? 'bg-amber-400' :
                          c === 'W' ? 'bg-slate-300' :
                          c === 'B' ? 'bg-gray-800' : 'bg-gray-400'
                        )} />
                      ))}
                    </div>
                  </td>
                  <td className="py-1 px-1 text-[9px] text-gray-600">{line.memo || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t text-center text-[10px] text-gray-500">
            <p>이 발주서는 전산시스템에서 자동 생성되었습니다.</p>
            <p>문의사항 있으시면 연락 바랍니다.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep('select')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          이전
        </Button>
        <Button
          size="lg"
          onClick={handleSendFax}
          disabled={isSending}
          className="flex items-center gap-2"
        >
          {isSending ? (
            <>
              <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
              전송중...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              팩스 전송 및 확정
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render Step 3: Confirm
  const renderStepConfirm = () => {
    const results = sendResult?.results || [];
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">발주 완료</h3>
          <p className="text-muted">
            총 {sendResult?.count || selectedLines.length}개 라인 처리됨
          </p>
          <p className="text-sm text-muted mt-1">
            {successResults.length}개 공장 성공, {failedResults.length}개 실패
          </p>
        </div>

        <div className="w-full max-w-lg space-y-2 max-h-60 overflow-auto">
          {results.map((result, idx) => (
            <div key={result.group.prefix} className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              result.success 
                ? "bg-green-50 border-green-200" 
                : "bg-red-50 border-red-200"
            )}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-red-600" />
                )}
                <div>
                  <span className="font-medium">{result.group.vendorName}</span>
                  <span className="text-xs text-muted ml-2">({result.group.prefix})</span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.group.lines.length}건
                </Badge>
                <div className="text-xs text-muted mt-1">
                  {result.group.faxNumber || 'Fax 미설정'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {failedResults.length > 0 && (
          <div className="text-center text-sm text-red-600">
            실패한 공장은 수동으로 확인해주세요.
          </div>
        )}

        <Button size="lg" onClick={() => { onClose(); onSuccess?.(); }}>
          완료
        </Button>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-[1200px] h-[90vh] flex flex-col bg-background">
      {/* Header */}
      <CardHeader className="flex items-center justify-between border-b py-3 px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">공장발주</h2>
          
          {/* Step Indicator */}
          <div className="flex items-center gap-1 ml-4">
            <div className={cn(
              "px-3 py-1 rounded text-sm",
              step === 'select' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              1. 공장선택
            </div>
            <ArrowRight className="w-4 h-4 text-muted" />
            <div className={cn(
              "px-3 py-1 rounded text-sm",
              step === 'preview' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              2. 미리보기
            </div>
            <ArrowRight className="w-4 h-4 text-muted" />
            <div className={cn(
              "px-3 py-1 rounded text-sm",
              step === 'confirm' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              3. 확정
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>

      {/* Content */}
      <CardBody className="flex-1 p-4 overflow-hidden">
        {step === 'select' && renderStepSelect()}
        {step === 'preview' && renderStepPreview()}
        {step === 'confirm' && renderStepConfirm()}
      </CardBody>
    </Card>
  );
}

export default FactoryOrderWizard;
