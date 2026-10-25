// Draws the 1200x630 link-preview image for every post, plus one for the
// rest of the site, into assets/og/. LinkedIn, X, Telegram and Slack show it
// when someone shares a link; without one LinkedIn shows a bare URL.
//
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/og.mjs           # draw missing images and fix front matter
//   node scripts/og.mjs --all     # redraw everything (after a title change)
//
// Each post gets `image: /assets/og/<file name>.png` in its front matter.
// CI only checks that the image exists; it does not draw anything.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// require() so a globally installed playwright (NODE_PATH) works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'og');
const redrawAll = process.argv.includes('--all');

const avatar = 'data:image/jpeg;base64,' + readFileSync(join(root, 'assets', 'avatar.jpg')).toString('base64');

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function frontMatter(text) {
  const block = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!block) return null;
  const fields = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
  }
  return { fields, end: block[0].length };
}

// Same palette and type as assets/style.css.
function card({ title, kicker, footer, zh }) {
  const titleFont = zh ? "'Noto Serif SC', serif" : "'Source Serif 4', serif";
  const size = title.length > (zh ? 18 : 48) ? (zh ? 62 : 60) : (zh ? 70 : 68);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@500;600&family=Noto+Sans+SC:wght@500&family=Noto+Serif+SC:wght@600&family=Source+Serif+4:opsz,wght@8..60,600&display=block">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #fcfcfd; color: #0c1b2a;
         font-family: 'IBM Plex Sans', 'Noto Sans SC', sans-serif; }
  .card { position: relative; height: 100%; padding: 64px 80px 56px; display: flex; flex-direction: column;
          border-top: 12px solid #006dae; }
  .card::after { content: ''; position: absolute; right: -120px; bottom: -160px; width: 520px; height: 520px;
                 border-radius: 50%; background: #edf4fa; z-index: 0; }
  .card > * { position: relative; z-index: 1; }
  .who { display: flex; align-items: center; gap: 18px; font-size: 26px; font-weight: 600; }
  .who img { width: 60px; height: 60px; border-radius: 50%; }
  .who .site { margin-left: auto; font: 500 22px 'IBM Plex Mono', monospace; color: #56667a; }
  .kicker { margin-top: 56px; align-self: flex-start; padding: 8px 18px; border-radius: 999px;
            background: #edf4fa; color: #00507f; font: 500 22px 'IBM Plex Mono', 'Noto Sans SC', monospace; }
  h1 { margin-top: 24px; font: 600 ${size}px/1.18 ${titleFont}; letter-spacing: ${zh ? '0.01em' : '-0.01em'};
       display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .footer { margin-top: auto; font-size: 24px; color: #56667a; }
</style></head><body><div class="card">
  <div class="who"><img src="${avatar}" alt=""><span>Shuoxun Wen</span><span class="site">blog.secureview.tech</span></div>
  <div class="kicker">${escape(kicker)}</div>
  <h1${zh ? ' lang="zh-Hans"' : ''}>${escape(title)}</h1>
  <div class="footer">${escape(footer)}</div>
</div></body></html>`;
}

function postCards() {
  const dir = join(root, '_posts');
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((file) => {
    const path = join(dir, file);
    const text = readFileSync(path, 'utf8');
    const fm = frontMatter(text);
    if (!fm) throw new Error(`${file}: no front matter`);
    const { title, project, lang, date } = fm.fields;
    const zh = lang === 'zh-Hans';
    const name = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    const day = new Date(date.slice(0, 10) + 'T00:00:00Z');
    const when = zh
      ? `${day.getUTCFullYear()} 年 ${day.getUTCMonth() + 1} 月 ${day.getUTCDate()} 日`
      : day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return { path, text, fm, name, html: card({ title, kicker: project, footer: when, zh }) };
  });
}

function setImage(post) {
  const image = `/assets/og/${post.name}.png`;
  const head = post.text.slice(0, post.fm.end);
  const body = post.text.slice(post.fm.end);
  const next = /^image:/m.test(head)
    ? head.replace(/^image:.*$/m, `image: ${image}`)
    : head.replace(/\n---\n$/, `\nimage: ${image}\n---\n`);
  if (next !== head) writeFileSync(post.path, next + body);
}

mkdirSync(outDir, { recursive: true });
const jobs = [
  { name: 'site', html: card({ title: 'How I build and run my own projects', kicker: 'Blog', footer: 'Computer Science · Monash University' }) },
  ...postCards(),
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const job of jobs) {
  const out = join(outDir, `${job.name}.png`);
  if (job.path) setImage(job);
  if (existsSync(out) && !redrawAll) continue;
  await page.setContent(job.html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  console.log(`drew assets/og/${job.name}.png`);
}
await browser.close();
