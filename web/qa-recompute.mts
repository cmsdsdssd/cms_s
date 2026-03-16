import 'dotenv/config';
import route from './src/app/api/pricing/recompute/route.ts';

const req = new Request('http://localhost/api/pricing/recompute', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    channel_id: 'c80a4fd4-bb77-4f81-ba86-f93d3c86b7b8',
    master_item_ids: ['4551f046-607f-4bf0-85db-9eafab542cd0'],
  }),
});

const res = await route.POST(req);
console.log('STATUS', res.status);
console.log(await res.text());
