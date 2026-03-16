import 'dotenv/config';
import route from './src/app/api/pricing/recompute/route.ts';
console.log(route);
console.log(typeof route, route && typeof route === 'object' ? Object.keys(route as Record<string, unknown>) : []);
