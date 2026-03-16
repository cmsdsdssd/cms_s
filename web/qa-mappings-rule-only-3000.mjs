import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/settings/shopping/mappings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Edit' }).first().click();
await page.waitForTimeout(3000);
const selects = await page.locator('select').evaluateAll((els) => els.map((el, index) => ({ index, options: Array.from(el.options).map((o) => ({ text: o.textContent, value: o.value })) })));
console.log(JSON.stringify(selects.slice(0, 8), null, 2));
await browser.close();
