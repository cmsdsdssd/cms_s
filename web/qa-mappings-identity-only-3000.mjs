import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/settings/shopping/mappings', { waitUntil: 'networkidle' });
const text = await page.locator('body').innerText();
console.log(text.slice(0, 1600));
await browser.close();
