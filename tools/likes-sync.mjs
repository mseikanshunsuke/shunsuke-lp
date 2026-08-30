// いいね集計の同期スクリプト
// GA4 の voice_like / voice_unlike を voice_id 別に集計し（得票 = like − unlike・下限0）、
// index.html の <!-- LIKES:START --> 〜 <!-- LIKES:END --> にJSONとして書き込む。
// 取得・解析に失敗したときは index.html に一切触れず異常終了する（前回の表示を守る）。
//
// 使い方（リポジトリのルートで実行）:
//   GA4_SA_KEY_FILE=/path/to/service-account.json node tools/likes-sync.mjs
// 環境変数:
//   GA4_SA_KEY_FILE … サービスアカウント鍵(JSON)のパス。または GA4_SA_KEY に鍵JSONそのもの
//   GA4_PROPERTY_ID … GA4プロパティID（省略時 543495673）
//   LIKES_START_DATE … 集計開始日（省略時 2026-08-30 = いいね機能の公開日）

import { readFileSync, writeFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '543495673';
const START_DATE = process.env.LIKES_START_DATE || '2026-08-30';
const TARGET = 'index.html';

function loadKey() {
  if (process.env.GA4_SA_KEY) return JSON.parse(process.env.GA4_SA_KEY);
  if (process.env.GA4_SA_KEY_FILE) return JSON.parse(readFileSync(process.env.GA4_SA_KEY_FILE, 'utf8'));
  console.error('GA4_SA_KEY_FILE か GA4_SA_KEY を指定してください。');
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(key.private_key));
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!res.ok) {
    console.error(`トークン取得失敗: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  return (await res.json()).access_token;
}

const key = loadKey();
const token = await getAccessToken(key);

const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dateRanges: [{ startDate: START_DATE, endDate: 'today' }],
    dimensions: [{ name: 'eventName' }, { name: 'customEvent:voice_id' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', inListFilter: { values: ['voice_like', 'voice_unlike'] } },
    },
    limit: 10000,
  }),
});
if (!res.ok) {
  console.error(`GA4取得失敗: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const report = await res.json();

// 集計: 得票 = like − unlike（下限0）。voice_id は英数と . _ - のみ許可（想定外の値は捨てる）
const ID_OK = /^[A-Za-z0-9._-]{1,32}$/;
const counts = {};
for (const row of report.rows || []) {
  const eventName = row.dimensionValues[0].value;
  const voiceId = row.dimensionValues[1].value;
  const n = Number(row.metricValues[0].value) || 0;
  if (!ID_OK.test(voiceId)) continue;
  counts[voiceId] = (counts[voiceId] || 0) + (eventName === 'voice_like' ? n : -n);
}
for (const k of Object.keys(counts)) {
  counts[k] = Math.max(0, counts[k]);
  if (counts[k] === 0) delete counts[k];
}

const payload = JSON.stringify(counts);
const START = '<!-- LIKES:START -->';
const END = '<!-- LIKES:END -->';
let target = readFileSync(TARGET, 'utf8');
const si = target.indexOf(START);
const ei = target.indexOf(END);
if (si === -1 || ei === -1 || ei < si) {
  console.error('index.html に LIKES マーカーが見つからない。中断。');
  process.exit(1);
}
const block = `${START}<script type="application/json" id="voiceLikeCounts">${payload}</script>${END}`;
const next = target.slice(0, si) + block + target.slice(ei + END.length);

if (next === target) {
  console.log(`変更なし（集計は前回と同じ・${Object.keys(counts).length}本）`);
  process.exit(0);
}
writeFileSync(TARGET, next);
console.log(`更新した: ${Object.keys(counts).length}本に得票（合計${Object.values(counts).reduce((a, b) => a + b, 0)}いいね）`);
