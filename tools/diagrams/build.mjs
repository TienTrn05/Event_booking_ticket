import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dir = path.join(root, 'docs/diagrams');
const output = path.join(dir, 'svg');
await mkdir(output, { recursive: true });
const config = JSON.parse(await readFile(path.join(here, 'mermaid-config.json'), 'utf8'));
const executablePath = process.env.DIAGRAM_BROWSER_PATH;
const puppeteerPath = path.join(root, '.local/puppeteer-diagrams.json');
await mkdir(path.dirname(puppeteerPath), { recursive: true });
await writeFile(puppeteerPath, JSON.stringify(executablePath ? { executablePath } : {}));
const files = (await readdir(dir)).filter(f => f.endsWith('.mmd')).sort();
const titles = JSON.parse(await readFile(path.join(here, 'titles.json'), 'utf8'));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(here, 'node_modules/@mermaid-js/mermaid-cli/src/cli.js'),
    '-i', path.join(dir, file), '-o', path.join(output, file.replace('.mmd', '.svg')),
    '-c', path.join(here, 'mermaid-config.json'), '-p', puppeteerPath, '-b', 'white'],
    { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr || result.stdout}`);
  console.log(`Rendered ${file}`);
}
const links = files.map(f => `<a href="#${f.slice(0,2)}">${escape(titles[f])}</a>`).join('\n');
const sections = files.map(f => `<section id="${f.slice(0,2)}"><h2>${escape(titles[f])}</h2><p><a href="svg/${f.replace('.mmd','.svg')}" target="_blank" rel="noopener">Mở SVG để phóng to / in</a> · <a href="${f}">Nguồn Mermaid</a></p><a href="svg/${f.replace('.mmd','.svg')}"><img loading="lazy" src="svg/${f.replace('.mmd','.svg')}" alt="${escape(titles[f])}"></a></section>`).join('\n');
await writeFile(path.join(dir,'index.html'), `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sơ đồ Event Ticketing Platform</title>
<style>html{scroll-behavior:smooth}body{margin:0;background:#f1f5f9;color:#172554;font:16px/1.65 system-ui,sans-serif}aside{position:fixed;inset:0 auto 0 0;width:250px;padding:24px;background:#0f172a;color:#fff;overflow:auto;box-sizing:border-box}aside a{display:block;color:#cbd5e1;text-decoration:none;padding:5px 0;font-size:14px}aside a:hover{color:#fff}main{margin-left:250px;padding:36px;max-width:1500px}h1{font-size:34px;line-height:1.2}h2{font-size:22px}section{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:24px;margin:24px 0;scroll-margin:20px}section img{display:block;max-width:100%;height:auto;margin:auto}a{color:#1d4ed8}.note{padding:14px 20px;border-left:4px solid #2563eb;background:#dbeafe}@media(max-width:850px){aside{position:static;width:auto}main{margin:0;padding:20px}}@media print{aside{display:none}main{margin:0;padding:0}section{break-inside:avoid}section p{display:none}}</style></head>
<body><aside><strong>EVENT TICKETING</strong><p>Bộ sơ đồ thiết kế</p>${links}</aside><main><h1>Kiến trúc &amp; dữ liệu</h1><p>${files.length} sơ đồ · Modular Monolith · MySQL · Đặt vé có kiểm soát đồng thời</p><p class="note">Bản thiết kế để review. Chính sách gắn Q-xxx chưa được chốt. ERD dùng tên bảng SQL; một số bảng tham chiếu xuất hiện ở nhiều sơ đồ. Trang này mở offline, không tải thư viện hoặc gửi dữ liệu ra ngoài.</p>${sections}</main></body></html>\n`, 'utf8');
await writeFile(path.join(dir,'README.md'), `# Bộ sơ đồ hệ thống\n\nMở [trang xem sơ đồ offline](index.html), hoặc xem các ảnh SVG dưới đây. Nguồn Mermaid là file cùng tên đuôi .mmd; ERD được sinh từ [schema SQL](../../database/schema.sql).\n\nHướng dẫn, phạm vi và các quyết định còn mở: [19 — Sơ đồ hệ thống](../19-system-diagrams.md).\n\n${files.map(f => `## ${titles[f]}\n\n[Nguồn Mermaid](${f}) · [SVG](svg/${f.replace('.mmd','.svg')})\n\n![${titles[f]}](svg/${f.replace('.mmd','.svg')})\n`).join('\n')}`, 'utf8');
console.log(`Built offline gallery with ${files.length} diagrams; theme: ${config.theme}`);
