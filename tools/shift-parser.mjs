// 店舗の日付属性を基準に読み、日付の推測で予定を一日ずらさない。
const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const clean = s => s.replace(/<a\b[\s\S]*?<\/a>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export function jstDate(now = new Date()) {
  const d = new Date(now.getTime() + 9 * 3600000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function parseSchedule(html, now = new Date()) {
  const ul = html.match(/<ul\b[^>]*\bid=["']pfschedule["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (!ul) throw new Error('出勤表が見つかりません。');
  const cells = [...ul[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1]);
  if (!cells.length || cells.length % 2) throw new Error('出勤表の日付と時間が対になっていません。');
  const today = jstDate(now), byDate = new Map();
  for (let i = 0; i < cells.length; i += 2) {
    const label = clean(cells[i]), body = clean(cells[i + 1]);
    const attr = cells[i + 1].match(/\bdata-date=["'](\d{4}-\d{2}-\d{2})["']/i);
    const md = label.match(/^(\d{1,2})月(\d{1,2})日\((.)\)$/);
    let date;
    if (attr) {
      date = new Date(attr[1] + 'T00:00:00Z');
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== attr[1]) throw new Error('出勤日が不正です。');
      if (label !== '本日' && (!md || +md[1] !== date.getUTCMonth() + 1 || +md[2] !== date.getUTCDate())) throw new Error('出勤日の表示と日付属性が一致しません。');
    } else {
      if (!md) throw new Error('日付を確定できません。「本日」には日付属性が必要です。');
      let year = today.getUTCFullYear();
      const diff = +md[1] - (today.getUTCMonth() + 1);
      if (diff < -6) year++; else if (diff > 6) year--;
      date = new Date(Date.UTC(year, +md[1] - 1, +md[2]));
      if (date.getUTCMonth() + 1 !== +md[1] || date.getUTCDate() !== +md[2]) throw new Error('出勤日が不正です。');
    }
    const key = date.toISOString().slice(0, 10);
    const old = byDate.get(key);
    if (old && old.body !== body) throw new Error('同じ日付に異なる予定があります。更新を中断します。');
    byDate.set(key, {key, dateLabel: `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`, dowLabel: DOW[date.getUTCDay()], body});
  }
  return [...byDate.values()].filter(r => r.key >= today.toISOString().slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key));
}
