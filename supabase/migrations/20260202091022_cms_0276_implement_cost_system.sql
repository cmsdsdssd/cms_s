-- 출고 원가 계산 시스템 구현 SQL
-- 1단계: DB 스키마 변경

-- 1.1 cms_shipment_line에 원가 관련 컬럼 추가
ALTER TABLE cms_shipment_line 
ADD COLUMN IF NOT EXISTS actual_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_material_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS actual_labor_cost_krw INTEGER,
ADD COLUMN IF NOT EXISTS cost_note TEXT,
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES cms_receipt_inbox(receipt_id);
-- 1.2 인덱스 생성 (성능)
CREATE INDEX IF NOT EXISTS idx_shipment_line_receipt_id ON cms_shipment_line(receipt_id);
CREATE INDEX IF NOT EXISTS idx_shipment_line_actual_cost ON cms_shipment_line(actual_cost_krw);
-- 2단계: 원가 계산 함수 생성

-- 2.1 영수증에서 원가 추출 함수
CREATE OR REPLACE FUNCTION extract_cost_from_receipt(p_receipt_id UUID)
RETURNS TABLE(
    material_cost INTEGER,
    labor_cost INTEGER,
    total_cost INTEGER,
    cost_breakdown JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- 소재비: 총액 - 공임 (공임이 별도 표기된 경우)
        COALESCE(
            (total_amount_krw - COALESCE(labor_amount_krw, 0))::INTEGER,
            (total_amount_krw * 0.8)::INTEGER  -- 공임 20% 가정
        ) as material_cost,
        
        COALESCE(labor_amount_krw::INTEGER, (total_amount_krw * 0.2)::INTEGER) as labor_cost,
        
        total_amount_krw::INTEGER as total_cost,
        
        jsonb_build_object(
            'receipt_total', total_amount_krw,
            'receipt_labor', labor_amount_krw,
            'exchange_rate', exchange_rate,
            'foreign_amount', foreign_amount,
            'currency', currency_code
        ) as cost_breakdown
    FROM cms_receipt_inbox
    WHERE receipt_id = p_receipt_id;
END;
$$ LANGUAGE plpgsql;
-- 2.2 마스터 기준가 조회 함수
CREATE OR REPLACE FUNCTION get_master_pricing(p_order_line_id UUID)
RETURNS TABLE(
    master_material_price INTEGER,
    master_labor_price INTEGER,
    master_total_price INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.material_amount_sell_krw::INTEGER,
        (mi.labor_base_sell + mi.labor_center_sell + mi.labor_sub1_sell + mi.labor_sub2_sell)::INTEGER,
        mi.total_amount_sell_krw::INTEGER
    FROM cms_order_line ol
    JOIN cms_master_item mi ON ol.matched_master_id = mi.master_item_id
    WHERE ol.order_line_id = p_order_line_id;
END;
$$ LANGUAGE plpgsql;
-- 2.3 최종 출고가 계산 함수 (손해 방지 로직)
CREATE OR REPLACE FUNCTION calculate_shipment_price(
    p_actual_material INTEGER,
    p_actual_labor INTEGER,
    p_master_material INTEGER,
    p_master_labor INTEGER,
    p_min_margin_rate DECIMAL DEFAULT 0.05
)
RETURNS TABLE(
    final_material INTEGER,
    final_labor INTEGER,
    final_total INTEGER,
    margin_rate DECIMAL,
    pricing_source TEXT
) AS $$
DECLARE
    v_cost_total INTEGER;
    v_master_total INTEGER;
    v_final_total INTEGER;
BEGIN
    v_cost_total := COALESCE(p_actual_material, 0) + COALESCE(p_actual_labor, 0);
    v_master_total := COALESCE(p_master_material, 0) + COALESCE(p_master_labor, 0);
    
    -- 최종 가격 = MAX(마스터가, 원가 + 마진)
    v_final_total := GREATEST(
        v_master_total,
        (v_cost_total * (1 + p_min_margin_rate))::INTEGER
    );
    
    RETURN QUERY
    SELECT 
        GREATEST(p_master_material, (p_actual_material * (1 + p_min_margin_rate))::INTEGER)::INTEGER,
        GREATEST(p_master_labor, (p_actual_labor * (1 + p_min_margin_rate))::INTEGER)::INTEGER,
        v_final_total,
        CASE 
            WHEN v_final_total = v_master_total THEN 0
            ELSE ((v_final_total - v_cost_total)::DECIMAL / NULLIF(v_cost_total, 0))
        END,
        CASE 
            WHEN v_final_total = v_master_total THEN 'MASTER'
            ELSE 'COST_BASED'
        END;
END;
$$ LANGUAGE plpgsql;
-- 3단계: 출고 확정 프로시저 (통합)

CREATE OR REPLACE FUNCTION confirm_shipment_with_cost_v1(
    p_shipment_id UUID,
    p_receipt_id UUID DEFAULT NULL,
    p_cost_mode TEXT DEFAULT 'MASTER',  -- 'MASTER' | 'RECEIPT' | 'MANUAL'
    p_manual_material INTEGER DEFAULT NULL,
    p_manual_labor INTEGER DEFAULT NULL,
    p_min_margin_rate DECIMAL DEFAULT 0.05,
    p_cost_note TEXT DEFAULT NULL,
    p_actor_person_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_shipment_line_id UUID;
    v_order_line_id UUID;
    v_actual_material INTEGER;
    v_actual_labor INTEGER;
    v_actual_total INTEGER;
    v_master_material INTEGER;
    v_master_labor INTEGER;
    v_master_total INTEGER;
    v_final_material INTEGER;
    v_final_labor INTEGER;
    v_final_total INTEGER;
    v_margin_rate DECIMAL;
    v_pricing_source TEXT;
    v_receipt_breakdown JSONB;
BEGIN
    -- 3.1 shipment_line_id 조회
    SELECT shipment_line_id, order_line_id
    INTO v_shipment_line_id, v_order_line_id
    FROM cms_shipment_line
    WHERE shipment_id = p_shipment_id
    LIMIT 1;
    
    -- 3.2 원가 결정
    IF p_cost_mode = 'RECEIPT' AND p_receipt_id IS NOT NULL THEN
        SELECT material_cost, labor_cost, total_cost, cost_breakdown
        INTO v_actual_material, v_actual_labor, v_actual_total, v_receipt_breakdown
        FROM extract_cost_from_receipt(p_receipt_id);
        
    ELSIF p_cost_mode = 'MANUAL' THEN
        v_actual_material := COALESCE(p_manual_material, 0);
        v_actual_labor := COALESCE(p_manual_labor, 0);
        v_actual_total := v_actual_material + v_actual_labor;
        v_receipt_breakdown := jsonb_build_object('mode', 'MANUAL');
        
    ELSE
        -- MASTER 모드: 마스터 가격을 원가로 간주
        SELECT master_material_price, master_labor_price, master_total_price
        INTO v_actual_material, v_actual_labor, v_actual_total
        FROM get_master_pricing(v_order_line_id);
        v_receipt_breakdown := jsonb_build_object('mode', 'MASTER');
    END IF;
    
    -- 3.3 마스터 기준가 조회
    SELECT master_material_price, master_labor_price, master_total_price
    INTO v_master_material, v_master_labor, v_master_total
    FROM get_master_pricing(v_order_line_id);
    
    -- 3.4 최종 출고가 계산
    SELECT final_material, final_labor, final_total, margin_rate, pricing_source
    INTO v_final_material, v_final_labor, v_final_total, v_margin_rate, v_pricing_source
    FROM calculate_shipment_price(
        v_actual_material, v_actual_labor,
        v_master_material, v_master_labor,
        p_min_margin_rate
    );
    
    -- 3.5 업데이트
    UPDATE cms_shipment_line
    SET 
        material_amount_sell_krw = v_final_material,
        labor_total_sell_krw = v_final_labor,
        total_amount_sell_krw = v_final_total,
        actual_material_cost_krw = v_actual_material,
        actual_labor_cost_krw = v_actual_labor,
        actual_cost_krw = v_actual_total,
        cost_note = COALESCE(p_cost_note, ''),
        receipt_id = p_receipt_id,
        status = 'CONFIRMED',
        confirmed_at = NOW()
    WHERE shipment_line_id = v_shipment_line_id;
    
    -- 3.6 결과 반환
    RETURN jsonb_build_object(
        'shipment_id', p_shipment_id,
        'shipment_line_id', v_shipment_line_id,
        'actual_cost', v_actual_total,
        'actual_material', v_actual_material,
        'actual_labor', v_actual_labor,
        'master_price', v_master_total,
        'final_price', v_final_total,
        'final_material', v_final_material,
        'final_labor', v_final_labor,
        'margin_rate', v_margin_rate,
        'pricing_source', v_pricing_source,
        'receipt_breakdown', v_receipt_breakdown,
        'confirmed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;
-- 4단계: 기존 데이터 마이그레이션

-- 4.1 현황 확인
SELECT 
    '총 출고 라인' as 항목,
    COUNT(*) as 건수
FROM cms_shipment_line
WHERE created_at >= '2026-02-02'

UNION ALL

SELECT 
    '원가 컬럼 NULL' as 항목,
    COUNT(*)
FROM cms_shipment_line
WHERE created_at >= '2026-02-02'
AND actual_cost_krw IS NULL;
-- 4.2 기존 데이터에 마스터 가격을 원가로 설정 (임시)
UPDATE cms_shipment_line sl
SET 
    actual_material_cost_krw = COALESCE(sl.material_amount_sell_krw, 0),
    actual_labor_cost_krw = COALESCE(sl.labor_total_sell_krw, 0),
    actual_cost_krw = COALESCE(sl.material_amount_sell_krw, 0) + COALESCE(sl.labor_total_sell_krw, 0)
WHERE sl.created_at >= '2026-02-02'
AND sl.actual_cost_krw IS NULL;
