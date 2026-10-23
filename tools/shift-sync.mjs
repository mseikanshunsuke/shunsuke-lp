// 出勤予定の自動同期スクリプト
// 所属店公式ページの出勤表（#pfschedule）を取得し、index.html の
// <!-- SHIFT:START --> 〜 <!-- SHIFT:END --> の間と「◯年◯月◯日時点」表記を書き換える。
// 取得失敗・解析失敗のときは index.html に一切触れず異常終了する（古い表示のまま守る）。
//
// 使い方: node tools/shift-sync.mjs      （リポジトリのルートで実行）

import { readFileSync, writeFileSync } from 'node:fs';
import { parseSchedule } from './shift-parser.mjs';

const SOURCE_URL = 'https://tokyo-m-seikan.com/s/honten/therapist/48/';
const TARGET = 'index.html';
const MIN_ROWS = 5; // これ未満しか取れなかったら店側の構造変化とみなして中断

function jstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000); // UTCメソッドで読むためのJSTシフト
}

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

// 「本日」の表示ではなく data-date の実日付を優先する。
// 同日の重複は統合し、異なる予定が衝突したら更新前に中断する。
let schedule;
try { schedule = parseSchedule(html); }
catch (err) { console.error(err.message); process.exit(1); }
const rows = schedule.map(({key, dateLabel, dowLabel, body: rawBody}) => {
  const off = rawBody === '-' || rawBody === '';
  const body = off ? 'お休み' : rawBody.replace('DM予約のみ', '').trim();
  const tag = !off && rawBody.includes('DM予約のみ') ? '<span class="shift-tag">DM予約のみ</span>' : '';
  return `        <div class="shift-row${off ? ' is-off' : ''}" data-shift-date="${key}"><span class="shift-date">${dateLabel}<span class="shift-dow">(${dowLabel})</span></span><span class="shift-time">${esc(body)}${tag}</span></div>`;
});

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
