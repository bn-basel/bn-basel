// Builds the profile README art: assets/header.svg and assets/card-*.svg.
// Everything is drawn by hand in code, in the same style as baselbn.vercel.app:
// near-black, monochrome, ASCII stars and the pixel-art astronaut.
// Run: node scripts/build.mjs   (needs sharp; the toolbox copy is used if it is not installed here)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = f => path.join(root, 'assets', f);
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('C:/WIP/tools/toolbox/node_modules/sharp'); }

// ---------- shared bits ----------
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const TINT = ['#7aa2ff', '#ffb86b', '#ff7ab6', '#5eead4', '#ffd166']; // the site's star tints
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rng(seed) { // mulberry32: the same stars every build
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const inside = (x, y, boxes) => boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

// ASCII stars: . + * like the site, a few tinted, some twinkling
function stars({ w, h, n, seed, avoid = [], twinkle = 0.22, tintRate = 0.12, minA = 0.14, size = 13 }) {
  const r = rng(seed); const parts = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(r() * w), y = Math.round(r() * h);
    if (inside(x, y, avoid)) continue;
    const z = Math.pow(r(), 2.2), tinted = r() < tintRate, zz = tinted ? Math.max(z, 0.55) : z;
    const ch = zz < 0.3 ? '.' : zz < 0.62 ? '+' : '*';
    const a = (tinted ? 0.5 + zz * 0.4 : minA + zz * 0.5).toFixed(2);
    const col = tinted ? TINT[Math.floor(r() * TINT.length)] : '#fff';
    const tw = r() < twinkle ? ` class="tw tw${1 + Math.floor(r() * 4)}" style="animation-delay:-${(r() * 5).toFixed(1)}s"` : '';
    parts.push(`<text x="${x}" y="${y}" fill="${col}" fill-opacity="${a}"${tw}>${ch}</text>`);
  }
  return `<g font-family="${MONO}" font-size="${size}" text-anchor="middle">${parts.join('')}</g>`;
}

// a faint diagonal band of dust, like the milky way drawn in characters (one <text> per row and brightness layer)
function dust({ w, h, seed, cw = 13, ch = 21, slope = -0.32, y0 = 0.62, width = 0.2, avoid = [] }) {
  const r = rng(seed); const cols = Math.ceil(w / cw), rows = Math.ceil(h / ch);
  const layers = [[' ', 0], ['.', 0.12], ['·', 0.15], [':', 0.17], [';', 0.19], ['+', 0.22]];
  const byLayer = layers.map(() => ({ x: [], y: [] }));
  for (let yi = 0; yi < rows; yi++) for (let xi = 0; xi < cols; xi++) {
    const u = xi / cols, v = yi / rows;
    const centre = y0 + slope * (u - 0.5) + Math.sin(u * 9) * 0.04;
    const d = Math.abs(v - centre) / width;
    const k = Math.max(0, 1 - d) * (0.5 + r() * 0.7);
    const li = Math.min(layers.length - 1, Math.floor(k * layers.length));
    // sparse and jittered, so it reads as dust and not as a grid
    if (li === 0 || r() > 0.42 * (1 - d * 0.5)) continue;
    const x = Math.round(xi * cw + r() * cw), y = Math.round(yi * ch + r() * ch);
    if (inside(x, y, avoid)) continue;
    byLayer[li].x.push(x); byLayer[li].y.push(y);
  }
  const out = byLayer.map((p, li) => p.x.length
    ? `<text x="${p.x.join(' ')}" y="${p.y.join(' ')}" fill-opacity="${layers[li][1]}">${layers[li][0].repeat(p.x.length)}</text>` : '').join('');
  return `<g font-family="${MONO}" font-size="12" fill="#cfd6e4" text-anchor="middle">${out}</g>`;
}

// 5x7 pixel letters for the name
const FONT = {
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
};
function pixelWord(word, x0, y0, cell, seed) {
  const r = rng(seed); const front = [], back = [];
  [...word].forEach((c, li) => FONT[c].forEach((row, yi) => [...row].forEach((b, xi) => {
    if (b !== '1') return;
    const x = x0 + (li * 6 + xi) * cell, y = y0 + yi * cell, s = cell - 2;
    back.push(`<rect x="${x + 5}" y="${y + 5}" width="${s}" height="${s}"/>`);
    // pixels land one by one, left to right with a little jitter
    const d = ((li * 6 + xi) * 0.035 + r() * 0.25).toFixed(2);
    front.push(`<rect class="px" style="animation-delay:${d}s" x="${x}" y="${y}" width="${s}" height="${s}"/>`);
  })));
  return `<g fill="#1c1c1c">${back.join('')}</g><g fill="#fafafa">${front.join('')}</g>`;
}

// a game-style speech bubble with notched corners and a tail on the right
function bubble(x, y, w, h, lines) {
  const n = 4;
  const d = `M${x + n} ${y}H${x + w - n}V${y + n}H${x + w}V${y + h / 2 - 6}H${x + w + 10}V${y + h / 2 + 2}H${x + w}V${y + h - n}H${x + w - n}V${y + h}H${x + n}V${y + h - n}H${x}V${y + n}H${x + n}Z`;
  const t = lines.map((s, i) => `<text class="say say${i + 1}" x="${x + 16}" y="${y + h / 2 + 5}">${esc(s)}</text>`).join('');
  return `<path d="${d}" fill="#fafafa"/><g font-family="${MONO}" font-size="15" font-weight="600" fill="#0a0a0a">${t}</g>`;
}

// ---------- astronaut sprite ----------
const src = path.join(here, 'astronaut-src.png');
const trimmed = await sharp(src).trim().png({ palette: true, colours: 64, effort: 10 }).toBuffer({ resolveWithObject: true });
const astro = { w: trimmed.info.width, h: trimmed.info.height, uri: 'data:image/png;base64,' + trimmed.data.toString('base64') };

// ---------- header ----------
{
  const W = 1200, H = 420;
  const AS = 0.82, aw = Math.round(astro.w * AS), ah = Math.round(astro.h * AS);
  const ax = 935, ay = 34;
  const css = `
    .tw{animation:tw 3.6s ease-in-out infinite}.tw2{animation-duration:4.4s}.tw3{animation-duration:2.9s}.tw4{animation-duration:5.3s}
    @keyframes tw{0%,100%{opacity:1}50%{opacity:.15}}
    .px{animation:px .5s steps(2,end) both}
    @keyframes px{from{opacity:0}to{opacity:1}}
    .float{animation:float 7s ease-in-out infinite;transform-origin:${ax + aw / 2}px ${ay + ah / 2}px}
    @keyframes float{0%,100%{transform:translate(0,0) rotate(-2.5deg)}50%{transform:translate(-6px,-12px) rotate(2.5deg)}}
    .say{opacity:0;animation:say 12s steps(1,end) infinite}.say1{opacity:1;animation-delay:0s}.say2{animation-delay:4s}.say3{animation-delay:8s}
    @keyframes say{0%{opacity:1}33.33%{opacity:0}100%{opacity:0}}
    .shoot{opacity:0;animation:shoot 9s linear infinite;animation-delay:2.5s}
    @keyframes shoot{0%{opacity:0;transform:translate(0,0)}1%{opacity:1}9%{opacity:0;transform:translate(-340px,170px)}100%{opacity:0;transform:translate(-340px,170px)}}
    .dot{animation:dot 2.4s ease-in-out infinite}
    @keyframes dot{0%,100%{opacity:1}50%{opacity:.35}}
    .cur{animation:cur 1.1s steps(1,end) infinite}
    @keyframes cur{50%{opacity:0}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
  const trail = ['/', '/', '/', '/', '/', '/'].map((c, i) =>
    `<text x="${820 + i * 12}" y="${70 - i * 6}" fill-opacity="${(1 - i / 6).toFixed(2)}">${c}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Basel. AI products for Saudi businesses. Founder of Mudeef, Computing and Software Systems (AI) at the University of Melbourne, SDAIA AI Scholar.">
<title>Basel</title>
<style>${css}</style>
<defs>
  <radialGradient id="neb" cx="0.78" cy="0.35" r="0.55"><stop offset="0" stop-color="#3b4a7a" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="neb2" cx="0.12" cy="0.9" r="0.45"><stop offset="0" stop-color="#5a3b52" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <clipPath id="clip"><rect width="${W}" height="${H}" rx="20"/></clipPath>
</defs>
<g clip-path="url(#clip)">
  <rect width="${W}" height="${H}" fill="#030406"/>
  <rect width="${W}" height="${H}" fill="url(#neb)"/>
  <rect width="${W}" height="${H}" fill="url(#neb2)"/>
  ${dust({ w: W, h: H, seed: 7, avoid: [[54, 218, 560, 296], [54, 326, 460, 384]] })}
  ${stars({ w: W, h: H, n: 190, seed: 42, avoid: [[50, 70, 570, 300], [40, 330, 470, 392]] })}
  <g class="shoot" font-family="${MONO}" font-size="14" fill="#fff">${trail}</g>

  ${pixelWord('BASEL', 64, 78, 16, 3)}
  <g font-family="${MONO}">
    <text x="64" y="248" font-size="25" fill="#ededed">AI products for Saudi businesses<tspan class="cur" fill="#fafafa">_</tspan></text>
    <text x="64" y="286" font-size="15.5" fill="#8f8f8f">founder @ mudeef · cs + ai @ unimelb · sdaia ai scholar</text>
  </g>
  <g transform="translate(64 336)">
    <rect width="384" height="38" rx="19" fill="#0b0d0c" stroke="#1f3b2c"/>
    <circle class="dot" cx="22" cy="19" r="5" fill="#22c55e"/>
    <circle cx="22" cy="19" r="9" fill="#22c55e" fill-opacity=".14"/>
    <text x="40" y="24" font-family="${MONO}" font-size="14" fill="#d4d4d4">open to internships &amp; freelance AI work</text>
  </g>

  <g class="float">
    ${bubble(ax - 272, ay + 26, 248, 40, ["Hey, I'm Basel.", 'Open to internships.', 'My projects are below.'])}
    <image href="${astro.uri}" x="${ax}" y="${ay}" width="${aw}" height="${ah}" style="image-rendering:pixelated"/>
  </g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="19.5" fill="none" stroke="#1d1f24"/>
</g>
</svg>`;
  fs.writeFileSync(out('header.svg'), svg);
}

// ---------- project cards ----------
// Facts come from the portfolio (content/projects.json) and each repo's README. Keep them in step.
const CARDS = [
  { file: 'card-allam-plus.svg', tag: 'ARABIC LLM · 2026', status: 'live', title: 'allam-plus',
    lines: ["HUMAIN's open ALLaM-7B, upgraded on one", '16 GB GPU: 4× the context, Arabic tool calls.'],
    metrics: [['4K → 16K', 'tokens of context'], ['96.0%', 'right tool, was 65.9%']],
    stack: 'PyTorch · YaRN · ALLaM', seed: 11 },
  { file: 'card-saudi-receptionist.svg', tag: 'FINE-TUNING · 2026', status: 'live', title: 'Saudi receptionist',
    lines: ['Gemma and ALLaM trained to answer in Saudi', 'dialect and use booking tools, on one GPU.'],
    metrics: [['93.8%', 'Gemma, level with DeepSeek'], ['40 → 87.5%', 'ALLaM, before → after']],
    stack: 'PyTorch · QLoRA · Gemma · ALLaM', seed: 12 },
  { file: 'card-context-study.svg', tag: 'AGENT RESEARCH · 2026', status: 'live', title: 'Context cost study',
    lines: ['565 coding-agent runs on how agents should', 'get project context.'],
    metrics: [['−36%', 'cost, same quality'], ['−49%', 'tokens']],
    stack: 'Python · Claude Code · benchmarks', seed: 13 },
  { file: 'card-chess-laya.svg', tag: 'SYSTEM-1 MODEL · 2026', status: 'done', title: 'system1-chess-laya',
    lines: ['A 421M one-step decision model taught to', 'play chess, measured against Stockfish.'],
    metrics: [['4.7 → 37%', 'puzzles solved'], ['1121', 'Elo, ~15 ms a move']],
    stack: 'PyTorch · python-chess · Stockfish', seed: 14 },
  { file: 'card-agent-team.svg', tag: 'DEV TOOLING · 2026', status: 'live', title: 'Claude Agent Team',
    lines: ['One Claude Code session plans with me, splits', 'the work across helpers, opens one PR.'],
    metrics: [['1', 'pull request per feature'], ['4', 'decisions left to me']],
    stack: 'Claude Code · Opus · GitHub', seed: 15 },
  { file: 'card-gemma-mini.svg', tag: 'ON-DEVICE AI · NOW', status: 'wip', title: 'gemma-mini',
    lines: ['An offline assistant for the Saudi desert,', 'in Saudi dialect, on Gemma 4 small models.'],
    metrics: [['1 of 11', 'planned steps done'], ['0', 'claims until measured']],
    stack: 'Gemma 4 · iPhone · offline', seed: 16 },
];
const STATUS = { live: ['#22c55e', 'live'], done: ['#a3a3a3', 'done'], wip: ['#e7a94e', 'in progress'], pilot: ['#22c55e', 'in pilot'] };

function card(c, W = 600, H = 340) {
  const [sc, sl] = STATUS[c.status];
  const mx = [36, 316];
  const metrics = c.metrics.map(([v, l], i) => `
    <text x="${mx[i]}" y="262" font-family="${SANS}" font-size="40" font-weight="700" fill="#fafafa" letter-spacing="-1">${esc(v)}</text>
    <text x="${mx[i]}" y="290" font-family="${MONO}" font-size="16" fill="#808080">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(c.title)}: ${esc(c.lines.join(' '))} ${esc(c.metrics.map(m => m.join(' ')).join('; '))}">
<title>${esc(c.title)}</title>
<style>.tw{animation:tw 3.6s ease-in-out infinite}.tw2{animation-duration:4.4s}.tw3{animation-duration:2.9s}.tw4{animation-duration:5.3s}@keyframes tw{0%,100%{opacity:1}50%{opacity:.15}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<defs><clipPath id="c"><rect width="${W}" height="${H}" rx="18"/></clipPath>
<radialGradient id="g" cx="1" cy="0" r="0.7"><stop offset="0" stop-color="#2a3350" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<g clip-path="url(#c)">
  <rect width="${W}" height="${H}" fill="#0a0a0b"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${stars({ w: W, h: H, n: 46, seed: c.seed, avoid: [[20, 20, 480, 175], [20, 215, 580, 330]], minA: 0.1, size: 12 })}
  <text x="36" y="50" font-family="${MONO}" font-size="13" fill="#7a7a7a" letter-spacing="1.5">${esc(c.tag)}</text>
  <g transform="translate(${W - 36} 45)"><circle cx="-${sl.length * 8 + 14}" cy="0" r="4.5" fill="${sc}"/><text x="0" y="5" text-anchor="end" font-family="${MONO}" font-size="13" fill="#a3a3a3">${sl}</text></g>
  <text x="36" y="102" font-family="${SANS}" font-size="32" font-weight="700" fill="#fafafa" letter-spacing="-.5">${esc(c.title)}</text>
  <text font-family="${SANS}" font-size="17.5" fill="#a3a3a3">${c.lines.map((l, i) => `<tspan x="36" y="${138 + i * 25}">${esc(l)}</tspan>`).join('')}</text>
  <line x1="36" y1="204" x2="${W - 36}" y2="204" stroke="#232326" stroke-dasharray="3 5"/>
  ${metrics}
  <text x="36" y="${H - 22}" font-family="${MONO}" font-size="14" fill="#5f6066">${esc(c.stack)}</text>
  <text x="${W - 36}" y="${H - 22}" text-anchor="end" font-family="${MONO}" font-size="14" fill="#8f8f8f">repo →</text>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="17.5" fill="none" stroke="#202124"/>
</svg>`;
}
for (const c of CARDS) fs.writeFileSync(out(c.file), card(c));

// ---------- Mudeef: wide card, code is private ----------
{
  const W = 1200, H = 300;
  const m = [['70+', 'branches at the chain in pilot talks'], ['8–9 → 2–3', 'messages to book, with WhatsApp Flows'], ['11,900+', 'automated tests before every release']];
  const mx = [48, 430, 812];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mudeef, founder, in pilot. Answers customers on WhatsApp in Saudi dialect, books appointments, and sends owners a monthly report on what to fix. 70+ branches at the chain in pilot talks; booking cut from 8–9 messages to 2–3; 11,900+ automated tests before every release.">
<title>Mudeef</title>
<style>.tw{animation:tw 3.6s ease-in-out infinite}.tw2{animation-duration:4.4s}.tw3{animation-duration:2.9s}.tw4{animation-duration:5.3s}@keyframes tw{0%,100%{opacity:1}50%{opacity:.15}}.dot{animation:dot 2.4s ease-in-out infinite}@keyframes dot{0%,100%{opacity:1}50%{opacity:.35}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<defs><clipPath id="c"><rect width="${W}" height="${H}" rx="20"/></clipPath>
<radialGradient id="g" cx="0.95" cy="0.1" r="0.6"><stop offset="0" stop-color="#0d5b49" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<g clip-path="url(#c)">
  <rect width="${W}" height="${H}" fill="#060908"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${stars({ w: W, h: H, n: 90, seed: 21, avoid: [[30, 20, 860, 150], [30, 170, 1170, 290]], minA: 0.1, size: 12 })}
  <text x="48" y="54" font-family="${MONO}" font-size="13" fill="#7a8a84" letter-spacing="1.5">NOW · AI PLATFORM · FOUNDER</text>
  <g transform="translate(${W - 48} 49)"><circle class="dot" cx="-78" cy="0" r="4.5" fill="#22c55e"/><text x="0" y="5" text-anchor="end" font-family="${MONO}" font-size="13" fill="#a3a3a3">in pilot</text></g>
  <text x="48" y="110" font-family="${SANS}" font-size="40" font-weight="700" fill="#fafafa" letter-spacing="-.5">Mudeef <tspan font-size="26" fill="#6f8b80" font-weight="600" font-family="'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif">مضيف</tspan></text>
  <text x="48" y="146" font-family="${SANS}" font-size="19" fill="#a3a3a3">Answers customers on WhatsApp in Saudi dialect, books appointments, and tells owners what to fix.</text>
  <line x1="48" y1="176" x2="${W - 48}" y2="176" stroke="#1d2622" stroke-dasharray="3 5"/>
  ${m.map(([v, l], i) => `<text x="${mx[i]}" y="234" font-family="${SANS}" font-size="44" font-weight="700" fill="#fafafa" letter-spacing="-1">${esc(v)}</text><text x="${mx[i]}" y="264" font-family="${MONO}" font-size="14" fill="#7a8a84">${esc(l)}</text>`).join('')}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="19.5" fill="none" stroke="#1a2420"/>
</svg>`;
  fs.writeFileSync(out('card-mudeef.svg'), svg);
}

// The avatar is the same pixel portrait used on Instagram and TikTok: assets/avatar.png, copied as is from the
// portfolio (public/uploads/basel-pixel-v4.png). Nothing to build.

console.log('built:', fs.readdirSync(path.join(root, 'assets')).map(f => `${f} ${(fs.statSync(out(f)).size / 1024).toFixed(1)}KB`).join(', '));
