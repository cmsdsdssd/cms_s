import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3006/settings/shopping/mappings', { waitUntil: 'networkidle' });
console.log('URL', page.url());
console.log('TITLE', await page.title());
console.log('TEXT', (await page.locator('body').innerText()).slice(0, 1200));
await page.screenshot({ path: 'qa-playwright-3006.png', fullPage: true });
await browser.close();
