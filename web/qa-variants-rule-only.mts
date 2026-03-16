import 'dotenv/config';
import route from './src/app/api/channel-products/variants/route.ts';
const url = new URL('http://localhost/api/channel-products/variants');
url.searchParams.set('channel_id', 'c80a4fd4-bb77-4f81-ba86-f93d3c86b7b8');
url.searchParams.set('master_item_id', '4551f046-607f-4bf0-85db-9eafab542cd0');
url.searchParams.set('external_product_no', '33');
const res = await route.GET(new Request(url.toString()));
const json = await res.json();
console.log('STATUS', res.status);
console.log(JSON.stringify({
  saved_option_categories: json?.data?.saved_option_categories?.slice(0, 12),
  canonical_option_rows: json?.data?.canonical_option_rows?.slice(0, 12),
}, null, 2));
