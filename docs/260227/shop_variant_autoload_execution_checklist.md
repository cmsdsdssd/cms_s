# Shop Variant Auto-Load Execution Checklist

## Goal
- Implement `product_no -> variant_code list` loading in shopping mappings UI.
- Keep option structure in Cafe24, and make our UI responsible for mapping + pricing sync orchestration.

## Execution Checklist
- [x] Define implementation scope and task breakdown
- [x] Add Cafe24 client helper for variant list retrieval by `product_no`
- [x] Add API route to fetch variant list from Cafe24 by `channel_id + product_no`
- [x] Add mappings UI actions for variant load / select / bulk mapping upsert
- [x] Prevent duplicate mapping writes and expose already-mapped state in UI
- [x] Run diagnostics and build verification
- [x] Final operator flow validation notes (what to edit where)

## Tracking Notes
- 2026-02-27: Checklist created and execution started.
- 2026-02-27: Variant list helper/API/UI/bulk upsert implemented.
- 2026-02-27: Mapping UX simplified (옵션 없는 상품 저장 안내, 수정 버튼, 옵션 분류-추가금 요약 표).
- 2026-02-27: Pull API schema-cache fallback added for missing `channel_price_snapshot.external_variant_code`.
- 2026-02-27: Mappings list changed to master-grouped 2-pane view (좌측 마스터 그룹, 우측 상세 행 편집/삭제).
- 2026-02-27: Added lightweight option rule columns on mapping (`size_weight_delta_g`, `option_price_delta_krw`).
- 2026-02-27: Recompute updated to apply per-variant material multiplier override, size weight delta, and fixed option delta.
- 2026-02-27: LSP diagnostics clean on modified files.
- 2026-02-27: `web` build passed (`npm run build`).
