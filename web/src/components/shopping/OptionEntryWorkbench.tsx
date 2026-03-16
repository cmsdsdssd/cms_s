"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { CurrentProductSyncProfile } from "@/lib/shop/current-product-sync-profile";

const CURRENT_PRODUCT_SYNC_PROFILE_OPTIONS: Array<{ value: CurrentProductSyncProfile; label: string; description: string }> = [
  { value: "GENERAL", label: "일반형", description: "기본 상품 흐름으로 유지" },
  { value: "MARKET_LINKED", label: "시장연동형", description: "시장 연동 기준으로 맞춤" },
];

export type WorkbenchEditorRow = {
  entry_key: string;
  axis_index: number;
  option_name: string;
  option_value: string;
  category_key: "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "ADDON" | "OTHER" | "NOTICE" | null;
  published_delta_krw: number;
  resolved_delta_krw: number;
  status: "READY" | "UNRESOLVED";
  unresolved_reason: string | null;
  material_registry_code: string | null;
  weight_g: number | null;
  combo_code: string | null;
  color_bucket_id: string | null;
  decor_master_id: string | null;
  addon_master_id: string | null;
  other_reason_code: string | null;
  explicit_delta_krw: number | null;
  notice_code: string | null;
};

export type WorkbenchEditorGroup = {
  axis_index: number;
  option_name: string;
  rows: WorkbenchEditorRow[];
};

type Choice = { value: string; label: string; delta_krw?: number | null };
type BucketChoice = { color_bucket_id: string; bucket_label: string; sell_delta_krw: number };
type SizeChoicesByMaterial = Record<string, Choice[]>;

type Props = {
  basePriceText: string;
  groups: WorkbenchEditorGroup[];
  draftsByKey: Record<string, WorkbenchEditorRow>;
  currentProductSyncProfile: CurrentProductSyncProfile;
  categoryChoices: Choice[];
  materialChoices: Choice[];
  colorChoices: Choice[];
  sizeChoicesByMaterial: SizeChoicesByMaterial;
  activeMaterialCode: string | null;
  colorBucketChoices: BucketChoice[];
  decorChoices: Choice[];
  addonChoices: Choice[];
  onChangeCurrentProductSyncProfile: (profile: CurrentProductSyncProfile) => void;
  onChangeRow: (entryKey: string, updater: (row: WorkbenchEditorRow) => WorkbenchEditorRow) => void;
  onChangeGroup: (group: WorkbenchEditorGroup, updater: (row: WorkbenchEditorRow) => WorkbenchEditorRow) => void;
  onSave: () => void;
  savePending: boolean;
  compact?: boolean;
  materialReadonly?: boolean;
};

export function OptionEntryWorkbench({
  basePriceText,
  groups,
  draftsByKey,
  currentProductSyncProfile,
  categoryChoices,
  materialChoices,
  colorChoices,
  sizeChoicesByMaterial,
  activeMaterialCode,
  colorBucketChoices,
  decorChoices,
  addonChoices,
  onChangeCurrentProductSyncProfile,
  onChangeRow,
  onChangeGroup,
  onSave,
  savePending,
  compact = false,
  materialReadonly = false,
}: Props) {
  const secondStageRefs = useRef<Record<string, HTMLSelectElement | HTMLInputElement | null>>({});
  const thirdStageRefs = useRef<Record<string, HTMLSelectElement | HTMLInputElement | null>>({});
  const materialLabelByValue = new Map(materialChoices.map((choice) => [choice.value, choice.label]));
  const isMarketLinked = currentProductSyncProfile === "MARKET_LINKED";
  const stackClassName = compact ? "space-y-2.5" : "space-y-4";
  const panelPaddingClassName = compact ? "p-2" : "p-3";
  const groupRowsClassName = compact ? "space-y-1.5" : "space-y-3";
  const shellPanelClassName = isMarketLinked
    ? "border-[var(--warning-soft)] bg-[linear-gradient(180deg,var(--warning-soft),var(--panel)_42%)]"
    : "border-[var(--hairline)] bg-[var(--panel)]";
  const nestedPanelClassName = isMarketLinked
    ? "border-[var(--warning-soft)] bg-[linear-gradient(180deg,var(--warning-soft),var(--background)_78%)]"
    : "border-[var(--hairline)] bg-[var(--background)]";
  const rowCardClassName = compact
    ? "grid grid-cols-1 gap-1.5 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-2 xl:grid-cols-[1.15fr_0.8fr_0.95fr_0.95fr_0.7fr]"
    : "grid grid-cols-1 gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_1fr]";
  const controlClassName = compact ? "h-7 px-2 py-1 text-[11px]" : undefined;
  const placeholderClassName = compact
    ? "flex h-7 items-center rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2 py-1 text-[11px] text-[var(--muted)]"
    : "flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]";
  const readonlyMaterialClassName = compact
    ? "flex h-7 items-center justify-between rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2 py-1 text-[11px] text-[var(--foreground)]"
    : "flex h-10 items-center justify-between rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";
  const labelClassName = compact ? "text-[9px] leading-4 text-[var(--muted)]" : "text-[11px] text-[var(--muted)]";
  const bodyTextClassName = compact ? "text-[11px] font-medium" : "text-sm font-medium";
  return (
    <div className={stackClassName}>
      <div className={`rounded-[var(--radius)] border ${shellPanelClassName} ${panelPaddingClassName}`}>
        <div className={`${compact ? "mb-1.5" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}>
          <div>
            <div className={bodyTextClassName}>옵션 행 워크벤치</div>
            <div className={compact ? "text-[10px] text-[var(--muted)]" : "text-xs text-[var(--muted)]"}>{groups.reduce((sum, group) => sum + group.rows.length, 0)}개 옵션 행</div>
          </div>
          <Button size="sm" className={compact ? "h-7 px-2 text-[11px]" : undefined} onClick={onSave} disabled={savePending || groups.length === 0}>
            {savePending ? "저장 중..." : "옵션 행 저장"}
          </Button>
        </div>
        <div className={`rounded-[var(--radius)] border ${nestedPanelClassName} ${panelPaddingClassName}`}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className={labelClassName}>현재 상품 동기화</div>
              <div className={`${compact ? "mt-1 text-[11px]" : "mt-2 text-sm"} flex flex-wrap items-center gap-2 font-medium`}>
                <span>{currentProductSyncProfile === "MARKET_LINKED" ? "시장연동형" : "일반형"}</span>
                {isMarketLinked ? (
                  <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                    MARKET_LINKED
                  </span>
                ) : null}
              </div>
              <div className={`${compact ? "mt-0.5 text-[10px]" : "mt-1 text-xs"} ${isMarketLinked ? "text-[var(--muted-strong)]" : "text-[var(--muted)]"}`}>
                옵션 수정 범위 안에서 현재 상품의 동기화 방식을 함께 결정합니다.
              </div>
            </div>
            <div role="radiogroup" aria-label="현재 상품 동기화 방식" className={`grid grid-cols-2 gap-1 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-1 ${compact ? "w-full max-w-[320px]" : "w-full max-w-[360px]"}`}>
              {CURRENT_PRODUCT_SYNC_PROFILE_OPTIONS.map((option) => {
                const isActive = option.value === currentProductSyncProfile;
                const isMarketLinkedOption = option.value === "MARKET_LINKED";
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => onChangeCurrentProductSyncProfile(option.value)}
                    className={[
                      "rounded-[calc(var(--radius)-2px)] border px-2.5 py-2 text-left transition-colors",
                      compact ? "min-h-[54px]" : "min-h-[60px]",
                      isActive
                        ? isMarketLinkedOption
                          ? "border-[var(--warning-soft)] bg-[var(--warning-soft)] text-[var(--foreground)] shadow-[var(--shadow-subtle)]"
                          : "border-[var(--hairline)] bg-[var(--background)] text-[var(--foreground)] shadow-[var(--shadow-subtle)]"
                        : "border-transparent bg-transparent text-[var(--muted-strong)] hover:border-[var(--hairline)] hover:bg-[var(--background)]",
                    ].join(" ")}
                  >
                    <div className={compact ? "text-[11px] font-semibold" : "text-sm font-semibold"}>{option.label}</div>
                    <div className={`${compact ? "mt-0.5 text-[9px] leading-4" : "mt-1 text-[11px] leading-4"} ${isActive ? "text-[var(--muted-strong)]" : "text-[var(--muted)]"}`}>
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className={`rounded-[var(--radius)] border ${nestedPanelClassName} ${panelPaddingClassName} ${compact ? "text-xs" : "text-sm"}`}>
          <div className={labelClassName}>가격 구성 요약</div>
          <div className={`${compact ? "mt-1" : "mt-2"} font-medium`}>base {basePriceText}</div>
          <div className={`${compact ? "mt-0.5 text-[10px]" : "mt-1 text-xs"} text-[var(--muted)]`}>옵션 카테고리는 직접 정합니다. 1차분류는 고정 소재이며, 카테고리를 선택하면 다음 분류 셀로 바로 이어집니다.</div>
        </div>
      </div>

      {groups.map((group) => (
        <div key={`${group.axis_index}-${group.option_name}`} className={`rounded-[var(--radius)] border ${nestedPanelClassName} ${panelPaddingClassName}`}>
          <div className={`${compact ? "mb-1.5 text-[11px]" : "mb-3 text-sm"} font-medium`}>Axis {group.axis_index} · {group.option_name}</div>
          <div className={groupRowsClassName}>
            {group.rows.map((row) => {
              const draft = draftsByKey[row.entry_key] ?? row;
              const groupCategory = group.rows.map((candidate) => draftsByKey[candidate.entry_key]?.category_key ?? candidate.category_key).find(Boolean) ?? null;
              const groupMaterialCode = group.rows.map((candidate) => draftsByKey[candidate.entry_key]?.material_registry_code ?? candidate.material_registry_code).find(Boolean) ?? activeMaterialCode ?? "";
              const effectiveDraft = { ...draft, category_key: groupCategory, material_registry_code: groupMaterialCode };
              const materialCode = effectiveDraft.material_registry_code ?? activeMaterialCode ?? "";
              const sizeChoices = sizeChoicesByMaterial[materialCode] ?? [];
              const materialLabel = materialLabelByValue.get(materialCode) ?? (materialCode || "-");
              return (
                <div key={row.entry_key} className={rowCardClassName}>
                  <div>
                    <div className={labelClassName}>옵션 카테고리</div>
                    <div className={`${compact ? "mb-1 text-[11px]" : "mb-2 text-sm"} font-medium`}>{row.option_value}</div>
                    <Select className={controlClassName} value={effectiveDraft.category_key ?? ""} onChange={(event) => {
                      const nextCategory = (event.target.value || null) as WorkbenchEditorRow["category_key"];
                      onChangeGroup(group, (current) => ({ ...current, category_key: nextCategory }));
                      queueMicrotask(() => {
                        if (nextCategory === "COLOR_PLATING") {
                          thirdStageRefs.current[row.entry_key]?.focus();
                        } else if (nextCategory) {
                          secondStageRefs.current[row.entry_key]?.focus();
                        }
                      });
                    }}>
                      <option value="">직접 선택</option>
                      {categoryChoices.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </Select>
                    {effectiveDraft.unresolved_reason ? <div className="mt-0.5 text-[9px] leading-4 text-amber-600">{effectiveDraft.unresolved_reason}</div> : null}
                  </div>

                  <div>
                    <div className={labelClassName}>1차분류</div>
                    {materialReadonly ? (
                      <div className={readonlyMaterialClassName} aria-readonly="true">
                        <span>{materialLabel}</span>
                        <span className="text-[9px] text-[var(--muted)]">readonly</span>
                      </div>
                    ) : (
                      <Select className={controlClassName} value={materialCode} onChange={(event) => onChangeGroup(group, (current) => ({ ...current, material_registry_code: event.target.value || null }))}>
                        <option value="">선택 안함</option>
                        {materialChoices.map((choice) => (
                          <option key={choice.value} value={choice.value}>{choice.label}</option>
                        ))}
                      </Select>
                    )}
                  </div>

                  <div>
                    <div className={labelClassName}>2차분류</div>
                    {effectiveDraft.category_key === "SIZE" ? (
                      <Select className={controlClassName} ref={(node) => { secondStageRefs.current[row.entry_key] = node; }} value={draft.weight_g == null ? "" : Number(draft.weight_g).toFixed(2)} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, weight_g: event.target.value ? Number(event.target.value) : null, resolved_delta_krw: Number(event.target.selectedOptions[0]?.dataset.delta ?? current.resolved_delta_krw) }))}>
                        <option value="">선택 안함</option>
                        {sizeChoices.map((choice) => (
                          <option key={choice.value} value={choice.value} data-delta={choice.delta_krw ?? 0}>{choice.label}</option>
                        ))}
                      </Select>
                    ) : effectiveDraft.category_key === "COLOR_PLATING" ? (
                      <Select className={controlClassName} ref={(node) => { secondStageRefs.current[row.entry_key] = node; }} value={draft.combo_code ?? ""} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, combo_code: event.target.value || null }))}>
                        <option value="">선택 안함</option>
                        {colorChoices.map((choice) => (
                          <option key={choice.value} value={choice.value}>{choice.label}</option>
                        ))}
                      </Select>
                    ) : effectiveDraft.category_key === "DECOR" ? (
                      <Select className={controlClassName} ref={(node) => { secondStageRefs.current[row.entry_key] = node; }} value={draft.decor_master_id ?? ""} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, decor_master_id: event.target.value || null }))}>
                        <option value="">선택 안함</option>
                        {decorChoices.map((choice) => (
                          <option key={choice.value} value={choice.value}>{choice.label}</option>
                        ))}
                      </Select>
                    ) : effectiveDraft.category_key === "ADDON" ? (
                      <Select className={controlClassName} ref={(node) => { secondStageRefs.current[row.entry_key] = node; }} value={draft.addon_master_id ?? ""} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, addon_master_id: event.target.value || null, resolved_delta_krw: Number(event.target.selectedOptions[0]?.dataset.delta ?? current.resolved_delta_krw) }))}>
                        <option value="">선택 안함</option>
                        {addonChoices.map((choice) => (
                          <option key={choice.value} value={choice.value} data-delta={choice.delta_krw ?? 0}>{choice.label}</option>
                        ))}
                      </Select>
                    ) : effectiveDraft.category_key === "OTHER" ? (
                      <Input className={controlClassName} ref={(node) => { secondStageRefs.current[row.entry_key] = node; }} value={draft.other_reason_code ?? ""} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, other_reason_code: event.target.value || null }))} />
                    ) : effectiveDraft.category_key === "NOTICE" ? (
                      <Input className={controlClassName} ref={(node) => { secondStageRefs.current[row.entry_key] = node; }} value={draft.notice_code ?? ""} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, notice_code: event.target.value || null }))} />
                    ) : (
                      <div className={placeholderClassName}>-</div>
                    )}
                  </div>

                  <div>
                    <div className={labelClassName}>3차분류</div>
                    {effectiveDraft.category_key === "COLOR_PLATING" ? (
                      <Select className={controlClassName} ref={(node) => { thirdStageRefs.current[row.entry_key] = node; }} value={draft.color_bucket_id ?? ""} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, color_bucket_id: event.target.value || null, resolved_delta_krw: Number(event.target.selectedOptions[0]?.dataset.delta ?? current.resolved_delta_krw) }))}>
                        <option value="">선택 안함</option>
                        {colorBucketChoices.map((choice) => (
                          <option key={choice.color_bucket_id} value={choice.color_bucket_id} data-delta={choice.sell_delta_krw}>{choice.bucket_label}</option>
                        ))}
                      </Select>
                    ) : effectiveDraft.category_key === "OTHER" ? (
                      <Input className={controlClassName} ref={(node) => { thirdStageRefs.current[row.entry_key] = node; }} value={draft.explicit_delta_krw == null ? "" : String(draft.explicit_delta_krw)} onChange={(event) => onChangeRow(row.entry_key, (current) => ({ ...current, explicit_delta_krw: event.target.value ? Number(event.target.value) : null, resolved_delta_krw: event.target.value ? Number(event.target.value) : 0 }))} />
                    ) : (
                      <div className={placeholderClassName}>-</div>
                    )}
                  </div>

                  <div>
                    <div className={labelClassName}>최종금액</div>
                    <div className={bodyTextClassName}>{draft.resolved_delta_krw.toLocaleString()} KRW</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
