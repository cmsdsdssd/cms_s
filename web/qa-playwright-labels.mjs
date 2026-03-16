import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/settings/shopping/mappings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Edit' }).first().click();
await page.waitForTimeout(3000);
const rows = await page.locator('tr').evaluateAll((trs) => trs.slice(0, 8).map((tr) => tr.innerText));
const selects = await page.locator('select').evaluateAll((els) => els.map((el, index) => ({
  index,
  aria: el.getAttribute('aria-label'),
  name: el.getAttribute('name'),
  options: Array.from(el.options).map((o) => ({ text: o.textContent, value: o.value }))
})));
console.log(JSON.stringify({ rows, selects: selects.slice(0, 15) }, null, 2));
await page.screenshot({ path: 'qa-playwright-labels.png', fullPage: true });
await browser.close();
