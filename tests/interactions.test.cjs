/**
 * Playwright interaction + link-integrity tests for the portfolio.
 *
 * Run:  node tests/interactions.test.cjs
 * (Requires the `playwright` package and a Chromium build. In this repo's
 *  dev container Chromium lives at /opt/pw-browsers/chromium.)
 *
 * These are plain assertions (no @playwright/test runner needed) so the
 * script stays dependency-light. Exit code is non-zero if anything fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Resolve the playwright library whether it's local or global.
let chromium;
for (const cand of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { ({ chromium } = require(cand)); break; } catch (_) {}
}
if (!chromium) {
  console.error('✗ Could not load playwright. Install it: npm i -D playwright');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const fileUrl = (rel) => 'file://' + path.join(ROOT, rel);

const results = [];
const ok = (name) => results.push({ name, pass: true });
const fail = (name, detail) => results.push({ name, pass: false, detail });
async function check(name, fn) {
  try { await fn(); ok(name); }
  catch (e) { fail(name, e.message); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

(async () => {
  const launchOpts = {};
  if (fs.existsSync('/opt/pw-browsers/chromium')) launchOpts.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  // Skip the intro loader for interaction tests.
  await page.addInitScript(() => { try { sessionStorage.setItem('hasVisited', 'true'); } catch (_) {} });

  // ---- Load ----
  await check('index.html loads with correct title', async () => {
    await page.goto(fileUrl('index.html'), { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    assert(/Mayuresh Khanaj/.test(title), `unexpected title: ${title}`);
  });

  await check('no uncaught JS errors on load', async () => {
    await page.waitForTimeout(500);
    assert(jsErrors.length === 0, 'JS errors: ' + jsErrors.join(' | '));
  });

  // ---- Loader hides ----
  await check('loader is hidden after visit', async () => {
    const display = await page.$eval('#meta-loader', el => getComputedStyle(el).display);
    assert(display === 'none', `loader display=${display}`);
  });

  // ---- Nav anchor scroll ----
  await check('nav "Projects" link scrolls to #projects', async () => {
    await page.click('.nav-links a[href="#projects"]');
    await page.waitForTimeout(700);
    const inView = await page.$eval('#projects', el => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    assert(inView, '#projects not in viewport after nav click');
  });

  // ---- Navbar scrolled state ----
  await check('navbar gains .scrolled after scrolling', async () => {
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    const scrolled = await page.$eval('.navbar', el => el.classList.contains('scrolled'));
    assert(scrolled, 'navbar missing .scrolled');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
  });

  // ---- Expandable about highlight ----
  await check('about highlight expands on click', async () => {
    const item = page.locator('.highlight-item.expandable').first();
    await item.locator('.highlight-header').click();
    await page.waitForTimeout(400);
    const expanded = await item.getAttribute('data-expanded');
    assert(expanded === 'true', `data-expanded=${expanded}`);
    const opacity = await item.locator('.highlight-details').evaluate(el => getComputedStyle(el).opacity);
    assert(parseFloat(opacity) > 0.5, `details opacity=${opacity}`);
  });

  // ---- Case study toggle ----
  await check('case study "More detail" toggles open/closed', async () => {
    const card = page.locator('.case-card').first();
    const btn = card.locator('.case-toggle');
    await btn.click();
    await page.waitForTimeout(200);
    assert(await card.evaluate(el => el.classList.contains('open')), 'card did not open');
    const extraVisible = await card.locator('.case-extra').evaluate(el => getComputedStyle(el).display !== 'none');
    assert(extraVisible, 'case-extra still hidden');
    const label = (await btn.textContent()).trim();
    assert(/Less detail/i.test(label), `button label after open: ${label}`);
    await btn.click();
    await page.waitForTimeout(200);
    assert(!(await card.evaluate(el => el.classList.contains('open'))), 'card did not close');
  });

  // ---- Stat counters ----
  await check('hero stat counters reach final values', async () => {
    await page.goto(fileUrl('index.html'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    const nums = await page.$$eval('.stat-number', els => els.map(e => e.textContent.trim()));
    assert(nums.includes('3+') && nums.includes('30%') && nums.includes('1TB+'),
      'stat values: ' + JSON.stringify(nums));
  });

  // ---- Mobile menu ----
  await check('mobile menu toggles open', async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(fileUrl('index.html'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const toggleVisible = await page.$eval('.nav-mobile-toggle', el => getComputedStyle(el).display !== 'none');
    assert(toggleVisible, 'mobile toggle not visible at 390px');
    await page.click('.nav-mobile-toggle');
    await page.waitForTimeout(200);
    assert(await page.$eval('.nav-links', el => el.classList.contains('active')), 'nav-links not active');
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  // ---- Blog page ----
  await check('blog.html loads and lists posts', async () => {
    await page.goto(fileUrl('blog.html'), { waitUntil: 'domcontentloaded' });
    const count = await page.locator('.post-card').count();
    assert(count >= 3, `only ${count} post cards`);
  });

  await check('a blog post opens from the listing', async () => {
    await page.locator('.post-card .read-more').first().click();
    await page.waitForTimeout(400);
    assert(/blog\/.+\.html$/.test(page.url()), `unexpected url: ${page.url()}`);
    const h1 = await page.locator('.blog-article h1').first().textContent();
    assert(h1 && h1.trim().length > 0, 'article h1 empty');
  });

  // ---- Link integrity (static analysis of every page) ----
  await check('all internal links & anchors resolve', async () => {
    const pages = ['index.html', 'blog.html',
      'blog/union_vs_union_all.html', 'blog/spark_optimization.html',
      'blog/postgres_trgm.html', 'blog/beauty_of_sql.html'];
    const problems = [];
    for (const rel of pages) {
      await page.goto(fileUrl(rel), { waitUntil: 'domcontentloaded' });
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
      const ids = await page.$$eval('[id]', els => els.map(e => e.id));
      for (const href of hrefs) {
        if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
        if (href.startsWith('#')) {
          if (href !== '#' && !ids.includes(href.slice(1))) problems.push(`${rel} → missing anchor ${href}`);
          continue;
        }
        const [p] = href.split('#');
        if (!p) continue;
        const target = path.join(ROOT, path.dirname(rel), p);
        if (!fs.existsSync(target)) problems.push(`${rel} → broken link ${href}`);
      }
    }
    assert(problems.length === 0, problems.join('\n   '));
  });

  await browser.close();

  // ---- Report ----
  console.log('\n  Portfolio interaction tests\n  ' + '─'.repeat(40));
  let failed = 0;
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}`);
    if (!r.pass) { failed++; console.log(`      ↳ ${r.detail}`); }
  }
  console.log('  ' + '─'.repeat(40));
  console.log(`  ${results.length - failed}/${results.length} passed\n`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
