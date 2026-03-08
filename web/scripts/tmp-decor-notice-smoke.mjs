import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(String.fromCharCode(10));
  for (const rawLine of lines) {
    const line = rawLine.replace(String.fromCharCode(13), '');
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function toSafeBaseUrl(value) {
  let out = String(value || '').trim();
  if (!out) out = 'http://localhost:3101';
  while (out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

async function apiJson(method, url, payload) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json };
}

async function getVariants(baseUrl, channelId, masterItemId, externalProductNo) {
  const query = new URLSearchParams({
    channel_id: channelId,
    master_item_id: masterItemId,
    external_product_no: externalProductNo,
  });
  return apiJson('GET', `${baseUrl}/api/channel-products/variants?${query.toString()}`);
}

async function main() {
  const baseUrl = toSafeBaseUrl(process.argv[2]);
  const envPath = path.resolve(__dirname, '../.env.local');
  const env = loadEnv(envPath);
  const supabaseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRole = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRole) throw new Error('Missing Supabase env in web/.env.local');

  const sb = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const reasonTag = `SMOKE_DECOR_NOTICE_${Date.now()}`;

  const { data: rules, error: rulesError } = await sb
    .from('channel_option_labor_rule_v1')
    .select('channel_id,master_item_id,external_product_no,decoration_master_id,decoration_model_name,base_labor_cost_krw,additive_delta_krw')
    .eq('category_key', 'DECOR')
    .eq('is_active', true)
    .not('decoration_master_id', 'is', null)
    .limit(200);

  if (rulesError) throw new Error(`Rule query failed: ${rulesError.message}`);
  const candidates = Array.isArray(rules) ? rules : [];

  for (const candidate of candidates) {
    const channelId = String(candidate.channel_id || '').trim();
    const masterItemId = String(candidate.master_item_id || '').trim();
    const externalProductNo = String(candidate.external_product_no || '').trim();
    const preferredDecorMasterId = String(candidate.decoration_master_id || '').trim();
    if (!channelId || !masterItemId || !externalProductNo || !preferredDecorMasterId) continue;

    const firstRead = await getVariants(baseUrl, channelId, masterItemId, externalProductNo);
    if (!firstRead.ok) continue;

    const data = firstRead.json?.data;
    const canonicalRows = Array.isArray(data?.canonical_option_rows) ? data.canonical_option_rows : [];
    const decorChoices = Array.isArray(data?.option_detail_allowlist?.decors) ? data.option_detail_allowlist.decors : [];
    if (canonicalRows.length < 2 || decorChoices.length === 0) continue;

    const selectedDecorChoice = decorChoices.find((row) => String(row?.decoration_master_id || '').trim() === preferredDecorMasterId)
      || decorChoices.find((row) => String(row?.decoration_master_id || '').trim().length > 0)
      || null;
    if (!selectedDecorChoice) continue;

    const selectedDecorMasterId = String(selectedDecorChoice.decoration_master_id || '').trim();
    if (!selectedDecorMasterId) continue;

    const decorEntry = canonicalRows.find((row) => String(row?.category_key || '') === 'DECOR') || canonicalRows[0];
    const noticeEntry = canonicalRows.find(
      (row) => String(row?.entry_key || '') !== String(decorEntry?.entry_key || '') && String(row?.category_key || '') === 'NOTICE',
    ) || canonicalRows.find((row) => String(row?.entry_key || '') !== String(decorEntry?.entry_key || ''));
    if (!decorEntry || !noticeEntry) continue;

    const decorEntryKey = String(decorEntry.entry_key || '').trim();
    const noticeEntryKey = String(noticeEntry.entry_key || '').trim();
    if (!decorEntryKey || !noticeEntryKey) continue;

    const expectedNotice = '배송안내';
    const baseLabor = isFiniteNumber(candidate.base_labor_cost_krw) ? Math.round(Number(candidate.base_labor_cost_krw)) : 0;
    const extraDelta = isFiniteNumber(candidate.additive_delta_krw) ? Math.round(Number(candidate.additive_delta_krw)) : 0;
    const finalAmount = baseLabor + extraDelta;

    const save = await apiJson('POST', `${baseUrl}/api/channel-product-option-mappings-v2-logs`, {
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: externalProductNo,
      change_reason: reasonTag,
      rows: [
        { axis_key: 'OPTION_CATEGORY', entry_key: decorEntryKey, category_key: 'DECOR' },
        {
          axis_key: 'OPTION_AXIS_SELECTION',
          entry_key: decorEntryKey,
          category_key: 'DECOR',
          axis1_value: String(selectedDecorChoice.label || '').trim() || String(candidate.decoration_model_name || '').trim() || 'DECOR',
          decor_master_item_id: selectedDecorMasterId,
          decor_extra_delta_krw: extraDelta,
          decor_final_amount_krw: finalAmount,
        },
        { axis_key: 'OPTION_CATEGORY', entry_key: noticeEntryKey, category_key: 'NOTICE' },
        {
          axis_key: 'OPTION_AXIS_SELECTION',
          entry_key: noticeEntryKey,
          category_key: 'NOTICE',
          axis1_value: expectedNotice,
          decor_master_item_id: null,
          decor_extra_delta_krw: null,
          decor_final_amount_krw: null,
        },
      ],
    });
    if (!save.ok) continue;

    const secondRead = await getVariants(baseUrl, channelId, masterItemId, externalProductNo);
    if (!secondRead.ok) continue;

    const afterRows = Array.isArray(secondRead.json?.data?.canonical_option_rows)
      ? secondRead.json.data.canonical_option_rows
      : [];
    const decorAfter = afterRows.find((row) => String(row?.entry_key || '') === decorEntryKey);
    const noticeAfter = afterRows.find((row) => String(row?.entry_key || '') === noticeEntryKey);
    if (!decorAfter || !noticeAfter) continue;

    const checks = [
      String(decorAfter.category_key || '') === 'DECOR',
      String(decorAfter.decor_master_item_id_selected || '') === selectedDecorMasterId,
      isFiniteNumber(decorAfter.decor_final_amount_krw)
        && Math.round(Number(decorAfter.decor_final_amount_krw)) === Math.round(Number(decorAfter.resolved_delta_krw || 0)),
      String(noticeAfter.category_key || '') === 'NOTICE',
      String(noticeAfter.notice_value_selected || '') === expectedNotice,
      Math.round(Number(noticeAfter.resolved_delta_krw || 0)) === 0,
    ];

    if (checks.every(Boolean)) {
      console.log(JSON.stringify({
        ok: true,
        baseUrl,
        reasonTag,
        channel_id: channelId,
        master_item_id: masterItemId,
        external_product_no: externalProductNo,
        decor_entry_key: decorEntryKey,
        notice_entry_key: noticeEntryKey,
        decor_master_item_id_selected: decorAfter.decor_master_item_id_selected,
        decor_final_amount_krw: decorAfter.decor_final_amount_krw,
        decor_resolved_delta_krw: decorAfter.resolved_delta_krw,
        notice_value_selected: noticeAfter.notice_value_selected,
        notice_resolved_delta_krw: noticeAfter.resolved_delta_krw,
      }, null, 2));
      return;
    }
  }

  throw new Error('No candidate passed DECOR/NOTICE smoke scenario');
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
