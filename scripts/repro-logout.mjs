// Single-flow E2E: /cms/banners → login → /cms/banners works
import { chromium } from 'playwright';

const ADMIN = 'http://localhost:3002';
const EMAIL = 'admin@denimisia.com';
const PASSWORD = 'Password123!';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on('response', (r) => {
  if (r.url().includes('/api/auth/callback') || r.url().includes('/cms/banners') || r.url().includes('/login')) {
    console.log(`  < ${r.status()}${r.headers()['location'] ? ' → ' + r.headers()['location'] : ''}  ${r.url()}`);
  }
});

console.log('=== 1) visit /cms/banners unauthed ===');
await page.goto(`${ADMIN}/cms/banners`, { waitUntil: 'networkidle' });
console.log('  landed:', page.url());

console.log('\n=== 2) fill + submit login form ===');
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
// Wait for csrf token to be fetched (button becomes enabled)
await page.waitForFunction(() => {
  const btn = document.querySelector('button[type=submit]');
  return btn && !btn.hasAttribute('disabled');
}, null, { timeout: 5000 }).catch(() => console.log('  (csrf wait timeout)'));
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle').catch(() => {});
console.log('  final url:', page.url());

const sess = await page.evaluate(async () => {
  const r = await fetch('/api/auth/session');
  return { status: r.status, body: (await r.text()).slice(0, 200) };
});
console.log('  session:', sess);

const cookies = (await ctx.cookies()).filter((c) => c.name.startsWith('authjs'));
for (const c of cookies) console.log(`  cookie: ${c.name} size=${c.value.length}`);

console.log('\n=== 3) result ===');
if (page.url().includes('/cms/banners') && !page.url().includes('/login')) {
  console.log('  ✅ SUCCESS — logged in and landed on /cms/banners');
} else {
  console.log('  ❌ FAIL — stuck on', page.url());
}

await browser.close();
