import 'dotenv/config';
import route from './src/app/api/channel-products/route.ts';
const req = new Request('http://localhost/api/channel-products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'c80a4fd4-bb77-4f81-ba86-f93d3c86b7b8', master_item_id: '4551f046-607f-4bf0-85db-9eafab542cd0', external_product_no: '33', external_variant_code: 'P00000BH000D', option_material_code: '925', option_color_code: '[도] G', option_size_value: 1, option_decoration_code: 'MS-553유색-R', mapping_source: 'MANUAL', is_active: true }) });
const res = await route.POST(req);
console.log('STATUS', res.status);
console.log(await res.text());
