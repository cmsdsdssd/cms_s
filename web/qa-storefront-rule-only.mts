import 'dotenv/config';
import route from './src/app/api/public/storefront-option-breakdown/route.ts';

const url = new URL('http://localhost/api/public/storefront-option-breakdown');
url.searchParams.set('mall_id', 'minddd3195');
url.searchParams.set('product_no', '33');
const token = process.env.STOREFRONT_BREAKDOWN_PUBLIC_TOKEN?.trim();
if (token) url.searchParams.set('token', token);
const res = await route.GET(new Request(url.toString()));
const json = await res.json();
console.log('STATUS', res.status);
console.log(JSON.stringify(json, null, 2));
