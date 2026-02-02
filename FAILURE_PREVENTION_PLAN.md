# 장애 예상 지점 보완 계획

## 문서 개요

**작성일**: 2026년 2월 2일  
**대상 시스템**: CMS (주문/출고/수금 관리 시스템)  
**총 예상 소요 시간**: 5일 (1인 기준)  
**위험도**: 중간 (데이터 정합성 이슈 가능성)

---

## 🎯 실행 로드맵

```
Day 1-2: 🔴 높은 우선순위 (재고 체크)
Day 3:   🟡 중간 우선순위 (서버 검증, 중복 방지)
Day 4:   🟢 낮은 우선순위 (이미지 검증, 에러 추적)
Day 5:   통합 테스트 및 문서화
```

---

## 🔴 우선순위 1: 재고 체크 누락 (출고 프로세스)

### 현재 상태

**위험도**: 🔴 **높음**  
**영향도**: 출고 시 재고 부족해도 처리 가능  
**발생 가능성**: 중간 (주문량 > 재고량 시)

```typescript
// 현재 shipments/page.tsx - 재고 체크 없음
const handleSaveShipment = async () => {
  if (!selectedOrderLineId) {
    toast.error("주문을 선택해주세요");
    return;
  }
  // ❌ 재고 체크 없음!
  await shipmentUpsertMutation.mutateAsync({...});
};
```

### 문제 시나리오

```
[시나리오 1] 초과 출고
1. 마스터 아이템 A의 재고: 10개
2. 주문 1: A 아이템 8개 출고 처리
3. 주문 2: A 아이템 5개 출고 처리 (재고 2개만 남았는데도 가능!)
4. 결과: 재고는 2개지만 5개 출고 기록 → 실제 물건 없음

[시나리오 2] 동시 출고
1. 사용자 A: 재고 3개 확인
2. 사용자 B: 재고 3개 확인 (동시에)
3. 사용자 A: 3개 출고 처리
4. 사용자 B: 3개 출고 처리 (실제로는 0개!)
```

### 보완 계획

#### Phase 1: 재고 확인 View 추가 (2시간)

```sql
-- Supabase View 생성
CREATE OR REPLACE VIEW cms_v_inventory_available AS
SELECT 
  master_item_id,
  COALESCE(incoming.qty, 0) - COALESCE(outgoing.qty, 0) AS available_qty,
  COALESCE(incoming.qty, 0) AS total_incoming,
  COALESCE(outgoing.qty, 0) AS total_outgoing
FROM (
  SELECT master_item_id, SUM(qty) as qty
  FROM cms_inventory_move
  WHERE direction = 'IN' AND status = 'POSTED'
  GROUP BY master_item_id
) incoming
FULL OUTER JOIN (
  SELECT master_item_id, SUM(qty) as qty
  FROM cms_inventory_move
  WHERE direction = 'OUT' AND status = 'POSTED'
  GROUP BY master_item_id
) outgoing ON incoming.master_item_id = outgoing.master_item_id;
```

#### Phase 2: 재고 체크 API 함수 추가 (3시간)

```typescript
// lib/contracts.ts에 추가
export const CONTRACTS = {
  // ... existing
  views: {
    // ... existing
    inventoryAvailable: "cms_v_inventory_available",
  },
  functions: {
    // ... existing
    inventoryCheck: "cms_fn_check_inventory_available_v1",
    inventoryReserve: "cms_fn_reserve_inventory_v1",  -- 낙관적 락용
  },
};
```

```typescript
// hooks/use-inventory-check.ts (신규 파일)
"use client";

import { useQuery } from "@tanstack/react-query";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";

interface InventoryCheckParams {
  masterItemId: string;
  requiredQty: number;
}

interface InventoryCheckResult {
  available: boolean;
  availableQty: number;
  reservedQty: number;
  shortage: number;
}

export function useInventoryCheck() {
  const schemaClient = getSchemaClient();

  return {
    checkAvailability: async ({
      masterItemId,
      requiredQty,
    }: InventoryCheckParams): Promise<InventoryCheckResult> => {
      if (!schemaClient) {
        throw new Error("Supabase client not available");
      }

      // 1. 재고 조회
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.inventoryAvailable)
        .select("*")
        .eq("master_item_id", masterItemId)
        .single();

      if (error) {
        throw new Error(`재고 조회 실패: ${error.message}`);
      }

      const availableQty = data?.available_qty ?? 0;
      const shortage = requiredQty - availableQty;

      return {
        available: shortage <= 0,
        availableQty,
        reservedQty: 0,  -- 추후 예약 기능 추가 시 사용
        shortage: shortage > 0 ? shortage : 0,
      };
    },
  };
}
```

#### Phase 3: 출고 프로세스에 재고 체크 통합 (4시간)

```typescript
// shipments/page.tsx 수정
import { useInventoryCheck } from "@/hooks/use-inventory-check";

export default function ShipmentsPage() {
  // ... existing hooks
  const { checkAvailability } = useInventoryCheck();
  
  // 출고 저장 전 재고 확인
  const handleSaveShipment = async () => {
    // ... existing validation

    // 1. 주문 정보에서 마스터 아이템 ID 조회
    const orderLine = await fetchOrderLine(selectedOrderLineId);
    const masterItemId = orderLine?.matched_master_id;
    
    if (!masterItemId) {
      toast.error("주문에 연결된 마스터 정보가 없습니다");
      return;
    }

    // 2. 재고 확인
    const inventoryCheck = await checkAvailability({
      masterItemId,
      requiredQty: orderLine.qty || 1,
    });

    if (!inventoryCheck.available) {
      toast.error(
        `재고가 부족합니다. ` +
        `필요: ${orderLine.qty}개, ` +
        `가용: ${inventoryCheck.availableQty}개, ` +
        `부족: ${inventoryCheck.shortage}개`
      );
      return;
    }

    // 3. 출고 처리 진행
    await shipmentUpsertMutation.mutateAsync({...});
  };
}
```

#### Phase 4: 낙관적 락 구현 (선택사항, 4시간)

```typescript
// 동시 출고 방지를 위한 예약 시스템
interface InventoryReservation {
  reservationId: string;
  masterItemId: string;
  reservedQty: number;
  expiresAt: Date;
  sessionId: string;
}

// hooks/use-inventory-reservation.ts
export function useInventoryReservation() {
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);

  const reserve = async ({
    masterItemId,
    qty,
  }: {
    masterItemId: string;
    qty: number;
  }): Promise<string | null> => {
    const reservationId = crypto.randomUUID();
    
    // RPC 호출로 원자적 예약
    const { data, error } = await callRpc<string>(
      CONTRACTS.functions.inventoryReserve,
      {
        p_master_item_id: masterItemId,
        p_qty: qty,
        p_reservation_id: reservationId,
        p_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5분
      }
    );

    if (error || !data) {
      return null;
    }

    return reservationId;
  };

  return { reserve };
}
```

### 테스트 계획

```typescript
// __tests__/inventory-check.test.ts

describe("재고 체크", () => {
  it("재고가 충분할 때 출고 가능", async () => {
    // Given: 재고 10개
    await setupInventory("ITEM_A", 10);
    
    // When: 5개 출고 시도
    const result = await checkAvailability({
      masterItemId: "ITEM_A",
      requiredQty: 5,
    });
    
    // Then: 가능
    expect(result.available).toBe(true);
  });

  it("재고가 부족할 때 출고 불가", async () => {
    // Given: 재고 3개
    await setupInventory("ITEM_B", 3);
    
    // When: 5개 출고 시도
    const result = await checkAvailability({
      masterItemId: "ITEM_B",
      requiredQty: 5,
    });
    
    // Then: 불가능
    expect(result.available).toBe(false);
    expect(result.shortage).toBe(2);
  });

  it("동시 출고 시 하나만 성공", async () => {
    // Given: 재고 1개
    await setupInventory("ITEM_C", 1);
    
    // When: 동시에 2개 출고 시도
    const [result1, result2] = await Promise.all([
      attemptShipment("ITEM_C", 1),
      attemptShipment("ITEM_C", 1),
    ]);
    
    // Then: 하나만 성공
    expect([result1, result2].filter(Boolean).length).toBe(1);
  });
});
```

### 예상 소요 시간
- **총 8-12시간** (1-1.5일)
- View 생성: 2시간
- TypeScript 코드: 4시간
- 테스트: 3시간
- 통합: 3시간

---

## 🟡 우선순위 2: 서버측 입력 검증 부재

### 현재 상태

**위험도**: 🟡 **중간**  
**영향도**: 잘못된 데이터 저장 가능  
**발생 가능성**: 낮음 (클라이언트 검증 있음)

```typescript
// /api/order-upsert/route.ts - 검증 없음
export async function POST(request: Request) {
  const payload = await request.json();  // ❌ 검증 없음!
  const { data, error } = await supabase.rpc(
    "cms_fn_upsert_order_line_v3", 
    payload  // 그대로 전달
  );
  // ...
}
```

### 문제 시나리오

```
[시나리오] 악의적인 요청
1. 공격자가 API 직접 호출
2. 필수값 누락된 payload 전송
3. 서버가 DB에 저장 시도
4. DB 에러 발생 또는 잘못된 데이터 저장
```

### 보완 계획

#### Phase 1: Zod 스키마 정의 (3시간)

```typescript
// lib/validation/schemas.ts (신규 파일)
import { z } from "zod";

// 주문 업서트 스키마
export const OrderUpsertSchema = z.object({
  p_customer_party_id: z.string().uuid("거래처 ID는 UUID 형식이어야 합니다"),
  p_master_id: z.string().uuid().nullable(),
  p_suffix: z.string().max(50).nullable(),
  p_color: z.string().max(10).nullable(),
  p_qty: z.number().positive("수량은 1 이상이어야 합니다"),
  p_size: z.string().max(20).nullable(),
  p_is_plated: z.boolean(),
  p_plating_variant_id: z.string().uuid().nullable(),
  p_plating_color_code: z.string().max(10).nullable(),
  p_requested_due_date: z.string().datetime().nullable(),
  p_priority_code: z.enum(["HIGH", "NORMAL", "LOW"]).nullable(),
  p_source_channel: z.string().max(50).nullable(),
  p_memo: z.string().max(500).nullable(),
  p_order_line_id: z.string().uuid().nullable(),  // null이면 생성
  p_center_stone_name: z.string().max(100).nullable(),
  p_center_stone_qty: z.number().nonnegative().nullable(),
  p_sub1_stone_name: z.string().max(100).nullable(),
  p_sub1_stone_qty: z.number().nonnegative().nullable(),
  p_sub2_stone_name: z.string().max(100).nullable(),
  p_sub2_stone_qty: z.number().nonnegative().nullable(),
  p_actor_person_id: z.string().uuid().nullable(),
});

// 마스터 아이템 스키마
export const MasterItemUpsertSchema = z.object({
  p_master_id: z.string().uuid().nullable(),
  p_model_name: z.string().min(1).max(100, "모델명은 1-100자여야 합니다"),
  p_master_kind: z.enum(["MODEL", "SET", "PART"]),
  p_category_code: z.string().max(50).nullable(),
  p_material_code_default: z.string().max(50).nullable(),
  p_weight_default_g: z.number().positive().nullable(),
  p_deduction_weight_default_g: z.number().nonnegative().default(0),
  // ... labor fields
  p_vendor_party_id: z.string().uuid().nullable(),
  p_note: z.string().max(1000).nullable(),
  p_image_path: z.string().max(500).nullable(),
  p_actor_person_id: z.string().uuid().nullable(),
});

// 출고 스키마
export const ShipmentUpsertSchema = z.object({
  p_order_line_id: z.string().uuid("주문 라인 ID가 필요합니다"),
  p_weight_g: z.number().positive("중량은 0보다 커야 합니다"),
  p_total_labor: z.number().nonnegative("공임은 0 이상이어야 합니다"),
  p_actor_person_id: z.string().uuid().nullable(),
  p_idempotency_key: z.string().uuid(),
});
```

#### Phase 2: API Route에 검증 미들웨어 적용 (4시간)

```typescript
// lib/validation/middleware.ts (신규 파일)
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  handler: (validated: T, request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const body = await request.json();
      const validated = schema.parse(body);
      return await handler(validated, request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));

        return NextResponse.json(
          {
            error: "입력값 검증 실패",
            details: issues,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "요청 처리 중 오류 발생",
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        },
        { status: 500 }
      );
    }
  };
}
```

```typescript
// /api/order-upsert/route.ts - 개선 버전
import { OrderUpsertSchema } from "@/lib/validation/schemas";
import { validateRequest } from "@/lib/validation/middleware";

export const POST = validateRequest(
  OrderUpsertSchema,
  async (validatedPayload, request) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase 설정 오류" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.rpc(
      "cms_fn_upsert_order_line_v3",
      validatedPayload
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ data });
  }
);
```

#### Phase 3: 모든 API Route에 적용 (3시간)

| API 파일 | 스키마 | 예상 소요 |
|----------|--------|-----------|
| `/api/order-upsert` | OrderUpsertSchema | 30분 |
| `/api/master-item` | MasterItemUpsertSchema | 30분 |
| `/api/receipt-upload` | ReceiptUploadSchema | 30분 |
| `/api/receipts` | ReceiptQuerySchema | 30분 |
| `/api/parties` | PartyQuerySchema | 30분 |
| `/api/market-ticks` | MarketTickSchema | 30분 |
| `/api/purchase-cost-worklist` | PurchaseCostSchema | 30분 |
| `/api/shipment-prefill` | ShipmentPrefillSchema | 30분 |

### 예상 소요 시간
- **총 10시간** (1.25일)
- Zod 설치 및 설정: 1시간
- 스키마 정의: 3시간
- 미들웨어 구현: 4시간
- 모든 API 적용: 3시간
- 테스트: 2시간

---

## 🟡 우선순위 3: 중복 수금 방지

### 현재 상태

**위험도**: 🟡 **중간**  
**영향도**: 동일 거래처 중복 수금 기록  
**발생 가능성**: 낮음 ~ 중간 (사용자 실수)

```typescript
// 현재 ar/page.tsx - 중복 체크 없음
const handleSubmitPayment = () => {
  paymentMutation.mutate({
    p_party_id: effectivePaymentPartyId,
    p_paid_at: new Date(paidAt).toISOString(),
    p_tenders: tenderPayload,
    p_memo: paymentMemo || null,
  });
  // ❌ 중복 체크 없음!
};
```

### 문제 시나리오

```
[시나리오 1] 사용자 실수
1. 사용자가 수금 등록 클릭
2. 네트워크 지연으로 응답 대기
3. 사용자가 "등록 안 된 줄 알고" 다시 클릭
4. 결과: 동일 수금 2번 등록

[시나리오 2] 새로고침 후 재전송
1. 수금 등록 완료
2. 사용자가 실수로 새로고침
3. 브라우저이 "이전 데이터 재전송" 경고
4. 사용자가 확인 클릭
5. 결과: 동일 수금 2번 등록
```

### 보완 계획

#### Phase 1: Idempotency Key 적용 (4시간)

```typescript
// hooks/use-idempotency-key.ts (신규 파일)
"use client";

import { useMemo, useRef } from "react";

export function useIdempotencyKey() {
  const key = useMemo(() => crypto.randomUUID(), []);
  const usedKeys = useRef<Set<string>>(new Set());

  const getKey = (operation: string): string => {
    const operationKey = `${key}-${operation}`;
    
    if (usedKeys.current.has(operationKey)) {
      // 이미 사용된 키면 새로 생성
      return `${operationKey}-${Date.now()}`;
    }
    
    usedKeys.current.add(operationKey);
    return operationKey;
  };

  return { getKey };
}

// ar/page.tsx 적용
export default function ARPage() {
  const { getKey } = useIdempotencyKey();
  
  const handleSubmitPayment = () => {
    const idempotencyKey = getKey("payment");
    
    paymentMutation.mutate({
      p_party_id: effectivePaymentPartyId,
      p_paid_at: new Date(paidAt).toISOString(),
      p_tenders: tenderPayload,
      p_memo: paymentMemo || null,
      p_idempotency_key: idempotencyKey,  // 추가!
    });
  };
}
```

#### Phase 2: DB Unique Constraint (2시간)

```sql
-- 중복 수금 방지용 유니크 인덱스
CREATE UNIQUE INDEX idx_cms_payment_unique 
ON cms_payment (party_id, DATE(paid_at), total_amount, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 또는 더 엄격하게 (idempotency_key 없이도)
CREATE UNIQUE INDEX idx_cms_payment_strict_unique 
ON cms_payment (party_id, DATE_TRUNC('minute', paid_at), total_amount);
```

#### Phase 3: 클라이언트측 중복 요청 방지 (2시간)

```typescript
// hooks/use-mutation-lock.ts (신규 파일)
"use client";

import { useRef, useCallback } from "react";

export function useMutationLock() {
  const isProcessing = useRef(false);

  const withLock = useCallback(async <T>(
    mutationFn: () => Promise<T>
  ): Promise<T | null> => {
    if (isProcessing.current) {
      console.warn("Mutation already in progress, skipping duplicate request");
      return null;
    }

    isProcessing.current = true;
    
    try {
      const result = await mutationFn();
      return result;
    } finally {
      // 딜레이 후 잠금 해제 (사용자가 "빠르게 두 번 클릭" 방지)
      setTimeout(() => {
        isProcessing.current = false;
      }, 1000);
    }
  }, []);

  return { withLock, isLocked: () => isProcessing.current };
}

// ar/page.tsx 적용
export default function ARPage() {
  const { withLock } = useMutationLock();
  
  const handleSubmitPayment = async () => {
    const result = await withLock(async () => {
      return paymentMutation.mutateAsync({...});
    });
    
    if (result === null) {
      toast.info("이미 처리 중입니다. 잠시만 기다려주세요.");
    }
  };
}
```

### 테스트 계획

```typescript
// __tests__/duplicate-payment.test.ts

describe("중복 수금 방지", () => {
  it("동일한 idempotency key로 중복 요청 시 하나만 성공", async () => {
    const payload = {
      p_party_id: "party-123",
      p_paid_at: new Date().toISOString(),
      p_tenders: [{ method: "CASH", amount: 10000, meta: "" }],
      p_idempotency_key: "same-key-123",
    };

    // 첫 번째 요청
    const result1 = await recordPayment(payload);
    expect(result1).toBeSuccess();

    // 두 번째 요청 (동일 키)
    const result2 = await recordPayment(payload);
    expect(result2).toBeDuplicate();  // 또는 기존 결과 반환
  });

  it("빠른 더블 클릭 시 하나만 처리", async () => {
    const payload = { ... };

    // 거의 동시에 두 번 클릭
    const [result1, result2] = await Promise.all([
      submitPayment(payload),
      submitPayment(payload),
    ]);

    // 하나만 성공 또는 둘 다 성공하나 DB에서 하나만 기록
    const successCount = [result1, result2].filter(r => r.success).length;
    expect(successCount).toBeLessThanOrEqual(1);
  });
});
```

### 예상 소요 시간
- **총 8시간** (1일)
- Idempotency key 구현: 4시간
- DB constraint: 2시간
- Mutation lock: 2시간
- 테스트: 2시간

---

## 🟢 우선순위 4: 이미지 경로 검증

### 현재 상태

**위험도**: 🟢 **낮음**  
**영향도**: 잘못된 이미지 경로 저장  
**발생 가능성**: 낮음

```typescript
// /api/master-item/route.ts - 이미지 경로 검증 없음
const rpcPayload = {
  // ...
  p_image_path: (body.image_path as string | null) ?? null,  // ❌ 검증 없음!
  // ...
};
```

### 문제 시나리오

```
[시나리오] 잘못된 경로 저장
1. 사용자가 잘못된 형식의 경로 입력
2. 예: "https://other-site.com/image.jpg" (외부 URL)
3. 예: "../../../etc/passwd" (경로 탐색 시도)
4. 저장은 되나 이미지 로드 실패
```

### 보완 계획

#### Phase 1: 이미지 경로 검증 유틸리티 (2시간)

```typescript
// lib/validation/image-path.ts (신규 파일)

const ALLOWED_BUCKETS = ["master-images", "receipts", "attachments"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export function validateImagePath(path: string | null): {
  valid: boolean;
  normalized: string | null;
  error?: string;
} {
  if (!path) {
    return { valid: true, normalized: null };
  }

  // 1. 외부 URL 체크
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return {
      valid: false,
      normalized: null,
      error: "외부 URL은 허용되지 않습니다. 내부 Storage 경로만 사용하세요.",
    };
  }

  // 2. 경로 정규화
  let normalized = path;
  
  // 선행 슬래시 제거
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  // 3. 경로 탐색 방지
  if (normalized.includes("..") || normalized.includes("./")) {
    return {
      valid: false,
      normalized: null,
      error: "잘못된 경로 형식입니다.",
    };
  }

  // 4. 버킷 확인
  const parts = normalized.split("/");
  const bucket = parts[0];
  
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return {
      valid: false,
      normalized: null,
      error: `허용되지 않은 버킷: ${bucket}. 사용 가능: ${ALLOWED_BUCKETS.join(", ")}`,
    };
  }

  // 5. 확장자 확인
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      normalized: null,
      error: `허용되지 않은 확장자: ${extension}`,
    };
  }

  // 6. 길이 제한
  if (normalized.length > 500) {
    return {
      valid: false,
      normalized: null,
      error: "경로가 너무 깁니다 (최대 500자).",
    };
  }

  return { valid: true, normalized };
}
```

#### Phase 2: API Route에 적용 (1시간)

```typescript
// /api/master-item/route.ts
import { validateImagePath } from "@/lib/validation/image-path";

export async function POST(request: Request) {
  const body = await request.json();
  
  // 이미지 경로 검증
  const imageValidation = validateImagePath(body.image_path);
  if (!imageValidation.valid) {
    return NextResponse.json(
      { error: imageValidation.error },
      { status: 400 }
    );
  }

  const rpcPayload = {
    // ...
    p_image_path: imageValidation.normalized,
    // ...
  };
  
  // ...
}
```

#### Phase 3: Storage 존재 확인 (선택사항, 3시간)

```typescript
// 이미지가 실제로 존재하는지 확인
export async function verifyImageExists(
  path: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const parts = path.split("/");
  const bucket = parts[0];
  const filePath = parts.slice(1).join("/");

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(filePath.split("/").slice(0, -1).join("/"), {
      search: filePath.split("/").pop(),
    });

  if (error || !data) return false;
  
  return data.length > 0;
}
```

### 예상 소요 시간
- **총 3-6시간** (0.5-0.75일)
- 검증 유틸리티: 2시간
- API 적용: 1시간
- Storage 확인 (선택): 3시간

---

## 🟢 우선순위 5: 에러 추적 시스템 (Sentry)

### 현재 상태

**위험도**: 🟢 **낮음** (운영 이슈)  
**영향도**: 에러 발생 시 원인 파악 어려움  
**발생 가능성**: 지속적

```typescript
// 현재 use-rpc-mutation.ts - 로컬 로깅만
onError: (error) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("[RPC ERROR]", e);  // ❌ production에서 추적 불가
  }
  toast.error("처리 실패", { description: message });
}
```

### 보완 계획

#### Phase 1: Sentry 설치 및 설정 (2시간)

```bash
# 패키지 설치
npm install @sentry/nextjs
```

```javascript
// sentry.client.config.ts (신규 파일)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // 성능 모니터링
  tracesSampleRate: 0.1,  // 10% 샘플링
  
  // 에러 샘플링
  sampleRate: 1.0,
  
  // 사용자 정보 제거 (개인정보 보호)
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

```javascript
// sentry.server.config.ts (신규 파일)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

```javascript
// next.config.ts 수정
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  // ... existing config
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: "your-org",
  project: "cms-project",
});
```

#### Phase 2: 에러 캡처 통합 (3시간)

```typescript
// hooks/use-rpc-mutation.ts - 개선 버전
import * as Sentry from "@sentry/nextjs";

export function useRpcMutation<TResult>(options: RpcMutationOptions<TResult>) {
  return useMutation({
    mutationFn: (params) => callRpc(options.fn, params),
    onSuccess: (data) => {
      // ...
    },
    onError: (error, variables) => {
      // 로컬 로깅
      if (process.env.NODE_ENV !== "production") {
        console.log("[RPC ERROR]", error);
      }

      // Sentry에 에러 보고
      Sentry.captureException(error, {
        tags: {
          rpc_function: options.fn,
          operation: "rpc_mutation",
        },
        extra: {
          variables,
          timestamp: new Date().toISOString(),
        },
        level: "error",
      });

      // 토스트 표시
      // ...
    },
  });
}
```

```typescript
// app/error.tsx (신규 파일 - 에러 바운더리)
"use client";

import * as Sentry from "@sentry/nextjs";
import Error from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <Error statusCode={500} title="Something went wrong!" />
      </body>
    </html>
  );
}
```

#### Phase 3: API Route 에러 추적 (1시간)

```typescript
// /api/order-upsert/route.ts - 개선 버전
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
  const transaction = Sentry.startTransaction({
    op: "api",
    name: "POST /api/order-upsert",
  });

  try {
    // ... 처리
    
    transaction.setStatus("ok");
    return NextResponse.json({ data });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { api_route: "/api/order-upsert" },
    });
    transaction.setStatus("error");
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    transaction.finish();
  }
}
```

#### Phase 4: 환경 변수 설정

```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://xxx@yyy.sentry.io/zzz
SENTRY_DSN=https://xxx@yyy.sentry.io/zzz
SENTRY_ORG=your-org
SENTRY_PROJECT=cms-project
```

### 예상 소요 시간
- **총 6시간** (0.75일)
- Sentry 설치/설정: 2시간
- 에러 캡처 통합: 3시간
- API Route 적용: 1시간
- 테스트: 2시간

---

## 📅 전체 실행 일정

### 일정표

| 일차 | 작업 | 소요시간 | 산출물 |
|------|------|----------|--------|
| **Day 1 오전** | 재고 체크 View 생성 | 4시간 | `cms_v_inventory_available` |
| **Day 1 오후** | 재고 체크 Hook 구현 | 4시간 | `useInventoryCheck.ts` |
| **Day 2 오전** | 출고 프로세스 통합 | 4시간 | 수정된 `shipments/page.tsx` |
| **Day 2 오후** | Zod 스키마 정의 | 4시간 | `validation/schemas.ts` |
| **Day 3 오전** | 서버 검증 미들웨어 | 4시간 | `validation/middleware.ts` |
| **Day 3 오후** | 중복 수금 방지 | 4시간 | `useMutationLock.ts`, DB constraint |
| **Day 4 오전** | 이미지 경로 검증 | 4시간 | `validation/image-path.ts` |
| **Day 4 오후** | Sentry 설정 | 4시간 | Sentry 통합, 에러 추적 |
| **Day 5** | 통합 테스트 | 8시간 | 테스트 코드, 문서화 |

### 리소스 필요사항

```
필요한 외부 서비스:
✅ Supabase - 이미 사용 중
⚠️  Sentry - 신규 가입/설정 필요

필요한 패키지:
- zod: ^3.x
- @sentry/nextjs: ^7.x
- @sentry/react: ^7.x (선택)

DB 변경사항:
- View 1개 생성
- Index 1-2개 생성
```

---

## 🧪 테스트 전략

### 통합 테스트 시나리오

```typescript
// tests/integration/failure-prevention.test.ts

describe("장애 예상 지점 보완 검증", () => {
  describe("재고 체크", () => {
    it("재고 부족 시 출고 불가", async () => {
      // 테스트 구현
    });
    
    it("동시 출고 시 하나만 성공", async () => {
      // 테스트 구현
    });
  });

  describe("입력 검증", () => {
    it("잘못된 UUID 형식 거부", async () => {
      const response = await fetch("/api/order-upsert", {
        method: "POST",
        body: JSON.stringify({
          p_customer_party_id: "invalid-uuid",
        }),
      });
      expect(response.status).toBe(400);
    });
    
    it("음수 수량 거부", async () => {
      const response = await fetch("/api/order-upsert", {
        method: "POST",
        body: JSON.stringify({
          p_qty: -1,
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe("중복 방지", () => {
    it("동일 idempotency key로 중복 요청 방지", async () => {
      // 테스트 구현
    });
  });

  describe("이미지 검증", () => {
    it("외부 URL 이미지 경로 거부", async () => {
      const result = validateImagePath("https://evil.com/image.jpg");
      expect(result.valid).toBe(false);
    });
    
    it("경로 탐색 시도 거부", async () => {
      const result = validateImagePath("../../../etc/passwd");
      expect(result.valid).toBe(false);
    });
  });
});
```

---

## ✅ 완료 체크리스트

### Phase 1: 재고 체크
- [ ] `cms_v_inventory_available` View 생성
- [ ] `useInventoryCheck` Hook 구현
- [ ] `shipments/page.tsx`에 통합
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성

### Phase 2: 서버 검증
- [ ] Zod 패키지 설치
- [ ] 스키마 정의 (Order, Master, Shipment)
- [ ] 검증 미들웨어 구현
- [ ] 모든 API Route에 적용
- [ ] 에러 메시지 한글화

### Phase 3: 중복 방지
- [ ] `useIdempotencyKey` Hook 구현
- [ ] `useMutationLock` Hook 구현
- [ ] DB unique constraint 생성
- [ ] RPC에 idempotency_key 파라미터 추가
- [ ] 더블 클릭 방지 UI 적용

### Phase 4: 이미지 검증
- [ ] `validateImagePath` 유틸리티 구현
- [ ] 버킷/확장자 화이트리스트 설정
- [ ] API Route에 적용
- [ ] 경로 탐색 공격 방지 검증

### Phase 5: 에러 추적
- [ ] Sentry 가입 및 프로젝트 생성
- [ ] 패키지 설치 및 설정
- [ ] Client/Server config 작성
- [ ] useRpcMutation에 통합
- [ ] API Route에 통합
- [ ] 알림 설정 (Slack/Email)

---

## 📊 ROI 분석 (투자 대비 효과)

| 항목 | 개발 비용 | 유지보수 비용 | 기대 효과 | ROI |
|------|-----------|---------------|-----------|-----|
| 재고 체크 | 12시간 | 낮음 | 초과 출고 방지 | **높음** |
| 서버 검증 | 10시간 | 낮음 | 데이터 무결성 | **중간** |
| 중복 방지 | 8시간 | 없음 | 중복 데이터 방지 | **중간** |
| 이미지 검증 | 6시간 | 없음 | 보안 강화 | **낮음** |
| 에러 추적 | 6시간 | 월 $26 | 장애 대응 시간 단축 | **높음** |

**총 개발 시간**: 42시간 (5.25일)  
**총 비용**: 개발자 1인 × 5일 + Sentry 월 $26  
**기대 효과**: 데이터 오염 방지, 운영 안정성 향상

---

## 🚨 리스크 및 대응 방안

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|--------|--------|--------|-----------|
| **DB 마이그레이션 실패** | 낮음 | 높음 | 백업 후 실행, 롤백 플랜 수립 |
| **Sentry 통합 오버헤드** | 중간 | 중간 | 샘플링 비율 조정 (10% → 1%) |
| **성능 저하** | 중간 | 중간 | 캐싱 적용, 비동기 처리 |
| **호환성 깨짐** | 낮음 | 높음 | 단계적 배포, 롤백 준비 |

---

## 📝 결론

### 핵심 요약

1. **즉시 실행 권장**: 재고 체크 (Day 1-2)
2. **단기 실행 권장**: 서버 검증 + 중복 방지 (Day 3)
3. **중기 실행 권장**: 에러 추적 (Day 4)
4. **선택 실행**: 이미지 검증 (여유 있을 때)

### 예상 효과

```
Before:
- 초과 출고 위험: 높음
- 잘못된 데이터: 가능
- 중복 수금: 가능
- 에러 파악: 어려움

After:
- 초과 출고 위험: 없음 (재고 체크)
- 잘못된 데이터: 없음 (서버 검증)
- 중복 수금: 없음 (idempotency)
- 에러 파악: 쉬움 (Sentry)
```

### 다음 단계

1. **즉시**: 재고 체크 View 생성 (DBA/개발자)
2. **1일차**: TypeScript 코드 구현
3. **2일차**: 테스트 및 통합
4. **3일차**: Sentry 가입 및 설정
5. **지속**: 모니터링 및 개선

---

**작성자**: AI Assistant  
**버전**: 1.0  
**마지막 수정**: 2026년 2월 2일
