import { NextResponse } from 'next/server';

import { getShopAdminClient, jsonError, parseJsonObject } from '@/lib/shop/admin';
import {
  normalizeOptionEntryMappingPayload,
  validateOptionEntryMappingPayload,
} from '@/lib/shop/option-entry-mapping';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const toTrimmed = (value: unknown): string => String(value ?? '').trim();

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const { searchParams } = new URL(request.url);
  const channelId = toTrimmed(searchParams.get('channel_id'));
  const externalProductNo = toTrimmed(searchParams.get('external_product_no'));

  if (!channelId) return jsonError('channel_id is required', 400);

  let query = sb
    .from('channel_product_option_entry_mapping_v1')
    .select('*')
    .eq('channel_id', channelId)
    .order('option_name', { ascending: true })
    .order('option_value', { ascending: true });

  if (externalProductNo) query = query.eq('external_product_no', externalProductNo);

  const { data, error } = await query;
  if (error) return jsonError(error.message ?? 'option entry mappings lookup failed', 500);

  return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError('Invalid request body', 400);

  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  if (rawRows.length === 0) return jsonError('rows is required', 400);

  const normalizedRows = [];
  for (let index = 0; index < rawRows.length; index += 1) {
    const rawRow = parseJsonObject(rawRows[index]);
    if (!rawRow) return jsonError(`rows[${index}] must be object`, 400);
    let normalized;
    try {
      normalized = normalizeOptionEntryMappingPayload(rawRow);
    } catch (error) {
      return jsonError(`rows[${index}]: ${error instanceof Error ? error.message : 'invalid category_key'}`, 400);
    }
    const validation = validateOptionEntryMappingPayload(normalized);
    if (!validation.ok) {
      return jsonError(`rows[${index}]: ${validation.errors[0] ?? 'invalid option entry mapping payload'}`, 422, {
        errors: validation.errors,
      });
    }
    normalizedRows.push(normalized);
  }

  const changedBy =
    toTrimmed(request.headers.get('x-user-email'))
    || toTrimmed(request.headers.get('x-user-id'))
    || toTrimmed(request.headers.get('x-user'))
    || null;
  const changeReason = typeof body.change_reason === 'string' ? toTrimmed(body.change_reason) : null;

  const { data, error } = await sb.rpc('cms_fn_upsert_channel_product_option_entry_mappings_v1', {
    p_rows: normalizedRows,
    p_changed_by: changedBy,
    p_change_reason: changeReason,
  });

  if (error) return jsonError(error.message ?? 'option entry mappings save failed', 400);

  return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
