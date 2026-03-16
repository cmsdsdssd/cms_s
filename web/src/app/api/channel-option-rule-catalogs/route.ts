import { NextResponse } from 'next/server';
import { getShopAdminClient, jsonError } from '@/lib/shop/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATALOGS = [
  { category_key: 'MATERIAL', label: '소재' },
  { category_key: 'SIZE', label: '사이즈' },
  { category_key: 'COLOR_PLATING', label: '색상/도금' },
  { category_key: 'DECOR', label: '장식' },
  { category_key: 'ADDON', label: '부가옵션' },
  { category_key: 'OTHER', label: '기타' },
  { category_key: 'NOTICE', label: '안내' },
] as const;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get('channel_id') ?? '').trim();
  if (!channelId) return jsonError('channel_id is required', 400);

  const ruleRes = await sb
    .from('channel_option_labor_rule_v1')
    .select('category_key')
    .eq('channel_id', channelId)
    .eq('is_active', true);
  if (ruleRes.error) return jsonError(ruleRes.error.message ?? '옵션 룰 카탈로그 조회 실패', 500);

  const counts = new Map();
  for (const row of ruleRes.data ?? []) {
    const key = String(row.category_key ?? '').trim().toUpperCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const data = [];
  for (const catalog of CATALOGS) {
    data.push({
      category_key: catalog.category_key,
      label: catalog.label,
      active_rule_count: counts.get(catalog.category_key) ?? 0,
    });
  }

  return NextResponse.json(data ? { data } : { data: [] }, { headers: { 'Cache-Control': 'no-store' } });
}
