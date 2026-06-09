#!/usr/bin/env node
/* RIOT screenshot driver — see SKILL.md in this directory.
 *
 * Self-contained: starts (or reuses) a local static server for the repo,
 * finds the ms-playwright Chromium cache, stubs Firebase so headless runs
 * never pollute the live rooms, walks the app, writes numbered PNGs.
 *
 *   node .claude/skills/screenshot/shoot.js tour [--city reus|brussels]
 *   node .claude/skills/screenshot/shoot.js shot [--desktop]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');

/* ---- args ---- */
const argv = process.argv.slice(2);
const mode = argv.find(a => !a.startsWith('--')) || 'tour';
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const CITY = opt('city', 'reus');
const PORT = Number(opt('port', '8741'));
const OUT = opt('out', path.join('/tmp/riot-shots', CITY));
const WANT_DESKTOP = argv.includes('--desktop');
const URL = `http://127.0.0.1:${PORT}/index.html?city=${CITY}`;

/* ---- deps ---- */
function loadPlaywright() {
  for (const t of ['playwright-core', '/tmp/riot-pw/node_modules/playwright-core']) {
    try { return require(t); } catch (e) { /* next */ }
  }
  console.error('playwright-core not found. Bootstrap once:\n  mkdir -p /tmp/riot-pw && cd /tmp/riot-pw && npm init -y && npm i playwright-core');
  process.exit(1);
}
function findChromium() {
  const roots = [
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),  // macOS
    path.join(os.homedir(), '.cache/ms-playwright'),          // Linux
  ];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    const dirs = fs.readdirSync(r).filter(d => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      for (const c of [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
      ].map(p => path.join(r, d, p))) if (fs.existsSync(c)) return c;
    }
  }
  console.error('No Chromium in the ms-playwright cache. Install once:\n  cd /tmp/riot-pw && npx playwright install chromium');
  process.exit(1);
}

/* ---- local server (reuse if something already serves this port) ---- */
async function ensureServer() {
  const probe = async () => { try { return (await fetch(URL)).ok; } catch (e) { return false; } };
  if (await probe()) return null;
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
    { cwd: REPO, stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  for (let i = 0; i < 40; i++) {
    if (await probe()) return srv;
    await new Promise(r => setTimeout(r, 250));
  }
  console.error(`Server did not come up on :${PORT}`);
  process.exit(1);
}

/* ---- app helpers ---- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Top card = #stack's LAST child; vote via DOM click (buttons are hidden while expanded).
const voteTop = (page, v) => page.evaluate(v => {
  const top = document.querySelector('#stack').lastChild;
  const b = top && top.querySelector(`.btn[data-v="${v}"]`);
  if (b) b.click();
}, v);
const isDone = page => page.evaluate(() => document.querySelector('#done').style.display === 'flex');

async function newPage(browser, desktop) {
  const ctx = await browser.newContext(desktop
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
    : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // Firebase stub: single-player fallback, no live-room pollution from headless runs.
  await ctx.route('**/firebase-config.js', r =>
    r.fulfill({ contentType: 'application/javascript', body: 'window.FIREBASE_CONFIG=null;' }));
  await ctx.route('**/*gstatic.com/**', r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(1200);
  return page;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  await ensureServer();
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
  const shot = async (page, name) => {
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('📸', path.join(OUT, name + '.png'));
  };

  if (mode === 'shot') {
    const page = await newPage(browser, false);
    await shot(page, '01-initial');
    if (WANT_DESKTOP) await shot(await newPage(browser, true), '01-initial-desktop');
  } else if (mode === 'tour') {
    const page = await newPage(browser, false);
    await shot(page, '01-initial');

    // expanded card ("See more")
    await page.evaluate(() => { const t = document.querySelector('#stack').lastChild; const m = t && t.querySelector('.more'); if (m) m.click(); });
    await sleep(400);
    await shot(page, '02-expanded');
    await page.keyboard.press('Escape');   // collapse — vote buttons are hidden while expanded
    await sleep(300);

    // past the map gate (auto-opens; wait out the reflow)
    for (const v of ['for', 'against', 'for', 'abstain', 'for']) { await voteTop(page, v); await sleep(300); }
    await sleep(800);
    await shot(page, '03-map-unlocked');

    // party comparison, mid-run
    await page.evaluate(() => { const el = document.querySelector('#affinity .pa'); if (el) el.click(); });
    await sleep(500);
    await shot(page, '04-party-compare');
    await page.evaluate(() => document.querySelector('#closeParty').click());
    await sleep(300);

    // finish the deck
    for (let i = 0; i < 200 && !(await isDone(page)); i++) { await voteTop(page, 'for'); await sleep(300); }
    await sleep(900);
    await shot(page, '05-done-top');
    await page.evaluate(() => { const s = document.querySelector('#done'); s.scrollTop = s.scrollHeight; });
    await sleep(400);
    await shot(page, '06-done-bottom');

    // options sheet, then raw-data view
    await page.evaluate(() => document.querySelector('#menuBtn').click());
    await sleep(450);
    await shot(page, '07-sheet');
    await page.evaluate(() => document.querySelector('#openLog').click());
    await sleep(500);
    await shot(page, '08-rawdata');

    await shot(await newPage(browser, true), '09-desktop-initial');
  } else {
    console.error(`Unknown mode "${mode}" — use: tour | shot`);
    process.exit(1);
  }

  await browser.close();
  process.exit(0);   // also kills the spawned server via the exit hook
})();
