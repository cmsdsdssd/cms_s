import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3007/settings/shopping/mappings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Edit' }).first().click();
await page.waitForTimeout(4000);
const selects = await page.locator('select').evaluateAll((els) => els.map((el, index) => ({ index, options: Array.from(el.options).map((o) => ({ text: o.textContent, value: o.value })) })));
console.log('URL', page.url());
console.log(JSON.stringify(selects.slice(0, 12), null, 2));
await page.screenshot({ path: 'qa-playwright-edit-only.png', fullPage: true });
await browser.close();
