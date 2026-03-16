import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3006/settings/shopping/mappings', { waitUntil: 'networkidle' });
const inputs = page.locator('input');
await page.locator('select').nth(0).selectOption({ index: 1 });
await inputs.nth(1).fill('4551f046-607f-4bf0-85db-9eafab542cd0');
await inputs.nth(2).fill('33');
await page.getByRole('button', { name: 'variant 불러오기' }).click();
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Edit' }).first().click();
await page.waitForTimeout(2000);
const selects = await page.locator('select').evaluateAll((els) => els.map((el, index) => ({ index, value: el.value, options: Array.from(el.options).map((o) => ({ text: o.textContent, value: o.value })) })));
console.log('URL', page.url());
console.log(JSON.stringify(selects.slice(0, 12), null, 2));
await page.screenshot({ path: 'qa-playwright-mappings-size.png', fullPage: true });
await browser.close();
