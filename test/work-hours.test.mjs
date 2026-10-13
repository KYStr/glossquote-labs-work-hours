import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHours, parseDate, parseTime, parseBreak, formatDecimalHours, formatDuration, buildReport, ProductError } from '../public/js/core/work-hours.mjs';

const row = (start = '09:00', end = '10:00', rest = '0', nextDay = false, date = '2026-10-01') => ({ date, start, end, nextDay, breakMinutes: rest });
const codes = (rows) => {
  const result = calculateHours(rows); assert.equal(result.ok, false); return result.errors.map((error) => error.code);
};
const rejects = (parser, value, code) => assert.throws(() => parser(value), (error) => error instanceof ProductError && error.code === code && error.message === code);

test('W01 independent example: 180 + 270 = 450 minutes / 7.50 hours', () => {
  const input = [row('09:00', '12:00'), row('13:00', '17:30')];
  const original = structuredClone(input);
  const result = calculateHours(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows.map((item) => [item.grossMinutes, item.breakMinutes, item.netMinutes]), [[180, 0, 180], [270, 0, 270]]);
  assert.deepEqual(result.days, [{ date: '2026-10-01', netMinutes: 450 }]);
  assert.equal(result.totalMinutes, 450); assert.equal(result.totalDecimalHours, '7.50');
  assert.equal(formatDuration(450, 'zh-Hant'), '7 小時 30 分');
  assert.equal(formatDuration(450, 'en'), '7 h 30 min');
  assert.deepEqual(input, original);
  assert.equal(Object.isFrozen(result.rows[0]), true);
});
test('W02 breaks deduct whole minutes', () => {
  const result = calculateHours([row('09:00', '18:00', '60')]);
  assert.equal(result.rows[0].grossMinutes, 540); assert.equal(result.totalMinutes, 480); assert.equal(result.totalDecimalHours, '8.00');
});
test('W03 overnight 240 gross - 30 break = 210; belongs to start date', () => {
  const result = calculateHours([row('22:00', '02:00', '30', true)]);
  assert.equal(result.rows[0].grossMinutes, 240); assert.equal(result.totalMinutes, 210); assert.equal(result.totalDecimalHours, '3.50');
  assert.deepEqual(result.days, [{ date: '2026-10-01', netMinutes: 210 }]);
});
test('W04 end before start requires next day', () => assert.deepEqual(codes([row('22:00', '02:00')]), ['END_ORDER']));
test('W05 equal clock times are invalid same day and exactly 24 hours next day', () => {
  assert.deepEqual(codes([row('09:00', '09:00')]), ['END_ORDER']);
  const result = calculateHours([row('09:00', '09:00', '0', true)]);
  assert.equal(result.totalMinutes, 1440); assert.equal(result.totalDecimalHours, '24.00');
});
test('W06 next day longer than 1440 minutes rejected', () => assert.deepEqual(codes([row('09:00', '10:00', '0', true)]), ['SPAN_LIMIT']));
test('W07 / W08 valid Gregorian dates and strict range', () => {
  assert.deepEqual(parseDate('2000-01-01'), { text: '2000-01-01', ordinal: 0 });
  assert.equal(parseDate('2000-02-29').ordinal, 59); assert.equal(parseDate('2024-02-29').ordinal, 8825);
  assert.equal(parseDate('2099-12-31').ordinal, 36524);
  for (const date of ['2023-02-29', '2100-02-29', '2026-04-31', '1999-12-31', '2026-00-01', '2026-13-01', '2026-01-00']) rejects(parseDate, date, 'DATE_RANGE');
  for (const date of ['2026-2-01', '2026/02/01', '２０２６-01-01', '\u00a02026-10-01', '']) rejects(parseDate, date, date === '' ? 'DATE_REQUIRED' : 'DATE_FORMAT');
});
test('W09 final input date can end in 2100 without changing attribution', () => {
  const result = calculateHours([row('23:00', '01:00', '0', true, '2099-12-31')]);
  assert.equal(result.totalMinutes, 120); assert.equal(result.rows[0].absoluteEnd, 52596060);
  assert.deepEqual(result.days, [{ date: '2099-12-31', netMinutes: 120 }]);
});
test('W10 strict ASCII HH:MM, all legal-row field errors are collected', () => {
  assert.equal(parseTime('00:00'), 0); assert.equal(parseTime('23:59'), 1439);
  for (const value of ['9:00', '24:00', '12:60', '12:00:00', '12:00 PM', '１２:00', '\u00a012:00']) rejects(parseTime, value, 'TIME_FORMAT');
  rejects(parseTime, ' \t\n\r ', 'TIME_REQUIRED'); rejects(parseTime, 60, 'TIME_FORMAT');
  const result = calculateHours([{ date: '', start: '', end: '24:00', nextDay: false, breakMinutes: '' }]);
  assert.deepEqual(result.errors.map(({ field, code }) => [field, code]), [['date', 'DATE_REQUIRED'], ['start', 'TIME_REQUIRED'], ['end', 'TIME_FORMAT'], ['breakMinutes', 'BREAK_REQUIRED']]);
  assert.equal(Object.hasOwn(result, 'totalMinutes'), false);
});
test('W11 strict break grammar; leading zeroes valid', () => {
  for (const value of ['-1', '1.5', '1e2', '+1', '1,000', ' 1 0 ', '１']) rejects(parseBreak, value, 'BREAK_FORMAT');
  rejects(parseBreak, '', 'BREAK_REQUIRED'); rejects(parseBreak, '1441', 'BREAK_RANGE');
  rejects(parseBreak, '9999999999999999', 'BREAK_RANGE'); rejects(parseBreak, null, 'BREAK_FORMAT');
  assert.equal(parseBreak('000030'), 30); assert.equal(parseBreak('1440'), 1440);
});
test('W12 full-span break is zero work; one minute excess rejected', () => {
  const result = calculateHours([row('10:00', '11:00', '60')]);
  assert.equal(result.totalMinutes, 0); assert.equal(result.totalDecimalHours, '0.00');
  assert.equal(formatDuration(0, 'zh-Hant'), '0 小時 0 分');
  assert.deepEqual(codes([row('10:00', '11:00', '61')]), ['BREAK_EXCEEDS_SPAN']);
});
test('W13 rejects overlap with original row indexes and no partial totals', () => {
  const result = calculateHours([row('09:00', '12:00'), row('11:00', '13:00')]);
  assert.deepEqual(result, { ok: false, errors: [{ code: 'ROW_OVERLAP', rowIndexes: [0, 1] }] });
});
test('W14 touching half-open ranges accepted', () => assert.equal(calculateHours([row('09:00', '12:00'), row('12:00', '13:00')]).totalMinutes, 240));
test('W15 overnight overlap with following date rejected', () => assert.deepEqual(codes([row('22:00', '02:00', '0', true), row('01:00', '03:00', '0', false, '2026-10-02')]), ['ROW_OVERLAP']));
test('W16 break totals cannot remove a gross interval overlap', () => assert.deepEqual(codes([row('09:00', '17:00', '420'), row('12:00', '13:00')]), ['ROW_OVERLAP']));
test('W17 nested interval containment rejected even when input is unsorted', () => {
  const result = calculateHours([row('12:00', '13:00'), row('09:00', '17:00'), row('10:00', '11:00')]);
  assert.deepEqual(result.errors[0], { code: 'ROW_OVERLAP', rowIndexes: [1, 2] });
});
test('W18 days sorted, input order retained', () => {
  const result = calculateHours([row('09:00', '10:00', '0', false, '2026-10-02'), row('09:00', '11:00')]);
  assert.deepEqual(result.days, [{ date: '2026-10-01', netMinutes: 120 }, { date: '2026-10-02', netMinutes: 60 }]);
  assert.deepEqual(result.rows.map(({ sourceIndex, date }) => [sourceIndex, date]), [[0, '2026-10-02'], [1, '2026-10-01']]);
  assert.equal(result.totalMinutes, 180);
});
test('W19 sum minutes before rounding three one-minute entries', () => {
  const result = calculateHours([row('09:00', '09:01'), row('10:00', '10:01'), row('11:00', '11:01')]);
  assert.equal(result.totalMinutes, 3); assert.equal(result.totalDecimalHours, '0.05');
});
test('W20 fixed integer half-up formatting', () => {
  for (const [minutes, expected] of [[1, '0.02'], [2, '0.03'], [59, '0.98'], [60, '1.00'], [90, '1.50'], [89280, '1488.00']]) assert.equal(formatDecimalHours(minutes), expected);
  assert.equal(formatDuration(60, 'en'), '1 h 0 min'); assert.equal(formatDuration(90, 'zh-Hant'), '1 小時 30 分');
  for (const value of [-1, 0.5, NaN, Infinity, 89281, '60']) rejects(formatDecimalHours, value, 'INVALID_RESULT');
  assert.throws(() => formatDuration(1, 'zh'), { code: 'INVALID_RESULT' });
});
test('W21 bounds: 1 / 62 / 63 rows; 62 adjacent 24-hour days', () => {
  assert.equal(calculateHours([row()]).ok, true);
  const rows = Array.from({ length: 62 }, (_, i) => row('00:00', '00:00', '0', true, new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10)));
  const result = calculateHours(rows);
  assert.equal(result.ok, true); assert.equal(result.totalMinutes, 89280); assert.equal(result.totalDecimalHours, '1488.00');
  assert.deepEqual(codes([...rows, row()]), ['ROWS_COUNT']);
  for (const value of [[], null, {}, 'rows']) assert.deepEqual(codes(value), ['ROWS_COUNT']);
});
test('W22 raw UTF-16 limits before ASCII-only trim', () => {
  assert.equal(parseDate(' '.repeat(22) + '2026-10-01').text, '2026-10-01');
  rejects(parseDate, ' '.repeat(23) + '2026-10-01', 'DATE_LENGTH');
  assert.equal(parseTime(' '.repeat(11) + '09:00'), 540); rejects(parseTime, ' '.repeat(12) + '09:00', 'TIME_LENGTH');
  assert.equal(parseBreak(' '.repeat(15) + '0'), 0); rejects(parseBreak, ' '.repeat(16) + '0', 'BREAK_LENGTH');
  assert.equal(parseDate('\t\r 2026-10-01 \n').text, '2026-10-01');
  rejects(parseDate, '😀'.repeat(17), 'DATE_LENGTH'); rejects(parseDate, undefined, 'DATE_FORMAT');
});
test('W25 complete bilingual reports, LF ending, overnight and totals', () => {
  const result = calculateHours([row('22:00', '02:00', '30', true)]);
  assert.equal(buildReport(result, 'en'), 'Work Hours Calculator | GlossQuote\nEntries: start date | start → end | next day | gross minutes | break minutes | net minutes (duration)\n1. 2026-10-01 | 22:00 → 02:00 | yes | 240 | 30 | 210 (3 h 30 min)\n\nDaily totals (by start date)\n2026-10-01: 210 min | 3 h 30 min | 3.50 h\n\nTotal: 210 min | 3 h 30 min | 3.50 h\nClock-time minutes; no time-zone or daylight-saving adjustment. Overnight entries belong entirely to their start date. No pay or attendance-law calculations.\n');
  const zh = buildReport(result, 'zh-Hant');
  assert.match(zh, /1\. 2026-10-01 \| 22:00 → 02:00 \| 是 \| 240 \| 30 \| 210 \(3 小時 30 分\)/);
  assert.match(zh, /總計: 210 分鐘 \| 3 小時 30 分 \| 3\.50 小時/); assert.ok(zh.endsWith('\n')); assert.ok(!zh.includes('\r'));
  for (const value of [null, { ok: false }, { ...result, totalMinutes: 1 }, { ...result, rows: [null] }]) assert.throws(() => buildReport(value, 'en'), { code: 'INVALID_RESULT' });
});
test('W30 exact schemas, all raw text is rejected without rendering or raw exceptions', () => {
  const malicious = '<img onerror=alert(1)>';
  for (const input of [[null], [[]], [{ ...row(), unknown: 'x' }], [{ ...row(), nextDay: 'false' }], [{ ...row(), start: 540 }], new Array(1)]) assert.deepEqual(codes(input), ['ROW_SCHEMA']);
  const result = calculateHours([{ ...row(), date: malicious, start: malicious, breakMinutes: malicious }]);
  assert.deepEqual(result.errors.map(({ code }) => code), ['DATE_FORMAT', 'TIME_LENGTH', 'BREAK_LENGTH']);
  assert.ok(!JSON.stringify(result).includes(malicious)); assert.ok(!JSON.stringify(result).includes('stack'));
});
