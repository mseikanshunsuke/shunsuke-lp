// 出勤予定の自動同期スクリプト
// 所属店公式ページの出勤表（#pfschedule）を取得し、index.html の
// <!-- SHIFT:START --> 〜 <!-- SHIFT:END --> の間と「◯年◯月◯日時点」表記を書き換える。
// 取得失敗・解析失敗のときは index.html に一切触れず異常終了する（古い表示のまま守る）。
//
// 使い方: node tools/shift-sync.mjs      （リポジトリのルートで実行）

import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE_URL = 'https://tokyo-m-seikan.com/s/honten/therapist/48/';
const TARGET = 'index.html';
const MIN_ROWS = 5; // これ未満しか取れなかったら店側の構造変化とみなして中断

function jstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000); // UTCメソッドで読むためのJSTシフト
}

function fmtDate(d) {
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const res = await fetch(SOURCE_URL, {
  headers: { 'User-Agent': 'Mozilla/5.0 (schedule sync; mseikan-shunsuke.com)' },
});
if (!res.ok) {
  console.error(`取得失敗: HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();

const ulMatch = html.match(/<ul id="pfschedule">([\s\S]*?)<\/ul>/);
if (!ulMatch) {
  console.error('出勤表（#pfschedule）が見つからない。店ページの構造が変わった可能性。');
  process.exit(1);
}

// <li class="...">日付</li> と <li>本文</li> の交互構造を順に読む
const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
const cells = [];
let m;
while ((m = liRe.exec(ulMatch[1])) !== null) {
  cells.push(
    m[1]
      .replace(/<a[\s\S]*?<\/a>/g, '') // 「空き状況」リンクを除去
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

const rows = [];
for (let i = 0; i + 1 < cells.length; i += 2) {
  const rawDate = cells[i];
  const rawBody = cells[i + 1];

  let dateLabel; let dowLabel;
  if (rawDate === '本日') {
    const now = jstNow();
    dateLabel = fmtDate(now);
    dowLabel = DOW[now.getUTCDay()];
  } else {
    const dm = rawDate.match(/^(\d{1,2})月(\d{1,2})日\((.)\)$/);
    if (!dm) {
      console.error(`日付の形式が想定外: "${rawDate}"`);
      process.exit(1);
    }
    dateLabel = `${Number(dm[1])}月${Number(dm[2])}日`;
    dowLabel = dm[3];
  }

  if (rawBody === '-' || rawBody === '') {
    rows.push(
      `        <div class="shift-row is-off"><span class="shift-date">${dateLabel}<span class="shift-dow">(${dowLabel})</span></span><span class="shift-time">お休み</span></div>`
    );
  } else {
    let body = rawBody;
    let tag = '';
    if (body.includes('DM予約のみ')) {
      body = body.replace('DM予約のみ', '').trim();
      tag = '<span class="shift-tag">DM予約のみ</span>';
    }
    rows.push(
      `        <div class="shift-row"><span class="shift-date">${dateLabel}<span class="shift-dow">(${dowLabel})</span></span><span class="shift-time">${esc(body)}${tag}</span></div>`
    );
  }
}

if (rows.length < MIN_ROWS) {
  console.error(`取得できた日数が少なすぎる（${rows.length}件）。中断。`);
  process.exit(1);
}

const now = jstNow();
const asOf = `${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月${now.getUTCDate()}日時点`;

let target = readFileSync(TARGET, 'utf8');
const before = target;

const START = '<!-- SHIFT:START -->';
const END = '<!-- SHIFT:END -->';
const si = target.indexOf(START);
const ei = target.indexOf(END);
if (si === -1 || ei === -1 || ei < si) {
  console.error('index.html に SHIFT マーカーが見つからない。中断。');
  process.exit(1);
}
target =
  target.slice(0, si + START.length) +
  '\n' + rows.join('\n') + '\n        ' +
  target.slice(ei);

target = target.replace(
  /(<span id="shiftAsOf">)[^<]*(<\/span>)/,
  `$1${asOf}$2`
);

if (target === before) {
  console.log('変更なし（出勤表は前回と同じ）。');
  process.exit(0);
}

writeFileSync(TARGET, target);
console.log(`更新した: ${rows.length}日分（${asOf}）`);
