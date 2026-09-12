// lib/calendar.js — pure date/grid math, no DB access. Dates are plain
// 'YYYY-MM-DD' strings throughout the app; everything here stays in that
// format rather than reaching for Date objects with timezones attached,
// except internally where a UTC-anchored Date is the easiest way to do
// calendar arithmetic without local-timezone drift.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// UTC midnight for a 'YYYY-MM-DD' string, so day arithmetic never trips
// over daylight saving or local-timezone rollover.
function utcDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso, n) {
  const d = utcDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

export function todayISO() {
  return toISODate(new Date());
}

// Inclusive date range as an array of 'YYYY-MM-DD' strings.
export function dateRange(startIso, endIso) {
  const out = [];
  let cur = startIso;
  while (cur <= endIso) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function monthLabel(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
}

// Returns { year, month } for `offset` months after (year, month). month is 0-indexed.
export function shiftMonth(year, month, offset) {
  const total = year * 12 + month + offset;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// Sunday-start month grid: an array of weeks, each an array of 7 cells
// ({ date: 'YYYY-MM-DD' } or null for padding outside the month).
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toISODate(new Date(Date.UTC(year, month, day))), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
