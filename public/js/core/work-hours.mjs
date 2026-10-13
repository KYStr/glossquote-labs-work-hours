export const MAX_ROWS = 62;
export const MAX_MINUTES = 89280;

export class ProductError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProductError';
    this.code = code;
  }
}

const trimASCII = (raw) => raw.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, '');

function boundedText(raw, kind, limit) {
  if (typeof raw !== 'string') throw new ProductError(`${kind}_FORMAT`);
  if (raw.length > limit) throw new ProductError(`${kind}_LENGTH`);
  const text = trimASCII(raw);
  if (text.length === 0) throw new ProductError(`${kind}_REQUIRED`);
  return text;
}

const leap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const monthLengths = (year) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseDate(raw) {
  const text = boundedText(raw, 'DATE', 32);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text)) throw new ProductError('DATE_FORMAT');
  const [year, month, day] = text.split('-').map(Number);
  const months = monthLengths(year);
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > months[month - 1]) {
    throw new ProductError('DATE_RANGE');
  }
  let ordinal = day - 1;
  for (let y = 2000; y < year; y++) ordinal += leap(y) ? 366 : 365;
  for (let m = 1; m < month; m++) ordinal += months[m - 1];
  return { text, ordinal };
}

export function parseTime(raw) {
  const text = boundedText(raw, 'TIME', 16);
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(text)) throw new ProductError('TIME_FORMAT');
  return Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
}

export function parseBreak(raw) {
  const text = boundedText(raw, 'BREAK', 16);
  if (!/^[0-9]+$/.test(text)) throw new ProductError('BREAK_FORMAT');
  const minutes = Number(text);
  if (!Number.isSafeInteger(minutes) || minutes > 1440) throw new ProductError('BREAK_RANGE');
  return minutes;
}

function validMinutes(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES) throw new ProductError('INVALID_RESULT');
}

function validLocale(locale) {
  if (locale !== 'zh-Hant' && locale !== 'en') throw new ProductError('INVALID_RESULT');
}

export function formatDuration(minutes, locale) {
  validMinutes(minutes);
  validLocale(locale);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return locale === 'zh-Hant' ? `${hours} 小時 ${remainder} 分` : `${hours} h ${remainder} min`;
}

export function formatDecimalHours(minutes) {
  validMinutes(minutes);
  const hundredths = Math.floor((minutes * 100 + 30) / 60);
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
}

const rowKeys = ['date', 'start', 'end', 'nextDay', 'breakMinutes'];
const fail = (errors) => ({ ok: false, errors });

export function calculateHours(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_ROWS) return fail([{ code: 'ROWS_COUNT' }]);
  const errors = [];
  const rows = [];
  for (let rowIndex = 0; rowIndex < input.length; rowIndex++) {
    const raw = input[rowIndex];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Reflect.ownKeys(raw).length !== rowKeys.length || !rowKeys.every((key) => Object.hasOwn(raw, key)) ||
        typeof raw.nextDay !== 'boolean' || !rowKeys.filter((key) => key !== 'nextDay').every((key) => typeof raw[key] === 'string')) {
      errors.push({ rowIndex, field: 'row', code: 'ROW_SCHEMA' });
      continue;
    }
    const parsed = {};
    const errorCount = errors.length;
    for (const [field, parser] of [['date', parseDate], ['start', parseTime], ['end', parseTime], ['breakMinutes', parseBreak]]) {
      try { parsed[field] = parser(raw[field]); }
      catch (error) {
        errors.push({ rowIndex, field, code: error instanceof ProductError ? error.code : 'ROW_SCHEMA' });
      }
    }
    if (errors.length !== errorCount) continue;
    const absoluteStart = parsed.date.ordinal * 1440 + parsed.start;
    const absoluteEnd = parsed.date.ordinal * 1440 + parsed.end + (raw.nextDay ? 1440 : 0);
    const grossMinutes = absoluteEnd - absoluteStart;
    if (grossMinutes <= 0) {
      errors.push({ rowIndex, field: 'end', code: 'END_ORDER' });
      continue;
    }
    if (grossMinutes > 1440) {
      errors.push({ rowIndex, field: 'end', code: 'SPAN_LIMIT' });
      continue;
    }
    if (parsed.breakMinutes > grossMinutes) {
      errors.push({ rowIndex, field: 'breakMinutes', code: 'BREAK_EXCEEDS_SPAN' });
      continue;
    }
    rows.push(Object.freeze({
      sourceIndex: rowIndex, date: parsed.date.text, start: trimASCII(raw.start), end: trimASCII(raw.end),
      nextDay: raw.nextDay, grossMinutes, breakMinutes: parsed.breakMinutes,
      netMinutes: grossMinutes - parsed.breakMinutes, absoluteStart, absoluteEnd
    }));
  }
  if (errors.length) return fail(errors);
  const ordered = [...rows].sort((a, b) => a.absoluteStart - b.absoluteStart || a.absoluteEnd - b.absoluteEnd || a.sourceIndex - b.sourceIndex);
  let longest = ordered[0];
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].absoluteStart < longest.absoluteEnd) {
      return fail([{ code: 'ROW_OVERLAP', rowIndexes: [longest.sourceIndex, ordered[i].sourceIndex].sort((a, b) => a - b) }]);
    }
    if (ordered[i].absoluteEnd > longest.absoluteEnd) longest = ordered[i];
  }
  const daily = new Map();
  let totalMinutes = 0;
  for (const row of rows) {
    totalMinutes += row.netMinutes;
    daily.set(row.date, (daily.get(row.date) ?? 0) + row.netMinutes);
  }
  const days = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, netMinutes]) => Object.freeze({ date, netMinutes }));
  return Object.freeze({ ok: true, rows: Object.freeze(rows), days: Object.freeze(days), totalMinutes, totalDecimalHours: formatDecimalHours(totalMinutes) });
}

export function buildReport(result, locale) {
  validLocale(locale);
  if (!result?.ok || !Array.isArray(result.rows) || !Array.isArray(result.days) ||
      result.rows.length < 1 || result.rows.length > MAX_ROWS || result.rows.some((row) => !row || typeof row !== 'object')) throw new ProductError('INVALID_RESULT');
  // Revalidate normalized rows so malformed callers cannot inject report content.
  const verified = calculateHours(result.rows.map((row) => ({ date: row.date, start: row.start, end: row.end, nextDay: row.nextDay, breakMinutes: String(row.breakMinutes) })));
  if (!verified.ok || verified.totalMinutes !== result.totalMinutes ||
      verified.totalDecimalHours !== result.totalDecimalHours || JSON.stringify(verified.days) !== JSON.stringify(result.days) ||
      result.rows.some((row, i) => JSON.stringify(row) !== JSON.stringify(verified.rows[i]))) throw new ProductError('INVALID_RESULT');
  const zh = locale === 'zh-Hant';
  const lines = [zh ? '工時加總 | GlossQuote' : 'Work Hours Calculator | GlossQuote',
    zh ? '每段：開始日期 | 開始 → 結束 | 次日 | 原始分鐘 | 休息分鐘 | 工時分鐘（時分）' : 'Entries: start date | start → end | next day | gross minutes | break minutes | net minutes (duration)'];
  for (const row of result.rows) {
    lines.push(`${row.sourceIndex + 1}. ${row.date} | ${row.start} → ${row.end} | ${zh ? (row.nextDay ? '是' : '否') : (row.nextDay ? 'yes' : 'no')} | ${row.grossMinutes} | ${row.breakMinutes} | ${row.netMinutes} (${formatDuration(row.netMinutes, locale)})`);
  }
  lines.push('', zh ? '每日小計（依開始日期）' : 'Daily totals (by start date)');
  for (const day of result.days) lines.push(`${day.date}: ${day.netMinutes} ${zh ? '分鐘' : 'min'} | ${formatDuration(day.netMinutes, locale)} | ${formatDecimalHours(day.netMinutes)} ${zh ? '小時' : 'h'}`);
  lines.push('', `${zh ? '總計' : 'Total'}: ${result.totalMinutes} ${zh ? '分鐘' : 'min'} | ${formatDuration(result.totalMinutes, locale)} | ${result.totalDecimalHours} ${zh ? '小時' : 'h'}`,
    zh ? '按鐘面分鐘計算，無時區或夏令時間調整。跨日時段全部歸開始日期。不計算工資或法規出勤。' : 'Clock-time minutes; no time-zone or daylight-saving adjustment. Overnight entries belong entirely to their start date. No pay or attendance-law calculations.');
  return `${lines.join('\n')}\n`;
}
