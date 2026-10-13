import { MAX_ROWS, parseDate, calculateHours, buildReport } from './core/work-hours.mjs';

export function localToday(now = new Date()) {
  const year = now.getFullYear();
  return year >= 2000 && year <= 2099 ? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` : '';
}

export function createWorksheet(locale, today = localToday) {
  let draftRows = [];
  let revision = 0;
  let copyRequestId = 0;
  let result = null;
  let errors = [];
  let example = false;
  let notice = 'idle';
  let copyStatus = 'idle';
  const blank = (date = today()) => ({ date, start: '', end: '', nextDay: false, breakMinutes: '0' });
  function invalidate(message = 'changed') {
    revision++;
    copyRequestId++;
    result = null;
    errors = [];
    copyStatus = 'idle';
    notice = message;
  }
  function reset() {
    invalidate('idle');
    draftRows = [blank()];
    example = false;
  }
  reset();
  return {
    view: () => ({ draftRows: draftRows.map((row) => ({ ...row })), revision, copyRequestId, result, errors: errors.map((error) => ({ ...error })), example, notice, copyStatus }),
    reset,
    edit(index, field, value) {
      if (!draftRows[index] || !Object.hasOwn(draftRows[index], field)) return false;
      invalidate();
      draftRows[index] = { ...draftRows[index], [field]: value };
      example = false;
      return true;
    },
    add() {
      if (draftRows.length >= MAX_ROWS) return false;
      let date;
      try { date = parseDate(draftRows.at(-1).date).text; } catch { date = today(); }
      invalidate();
      draftRows.push(blank(date));
      return true;
    },
    remove(index) {
      if (draftRows.length <= 1 || !Number.isInteger(index) || index < 0 || index >= draftRows.length) return false;
      invalidate();
      draftRows.splice(index, 1);
      return true;
    },
    loadExample() {
      invalidate('example');
      draftRows = [
        { date: '2026-10-01', start: '09:00', end: '12:00', nextDay: false, breakMinutes: '0' },
        { date: '2026-10-01', start: '13:00', end: '17:30', nextDay: false, breakMinutes: '0' }
      ];
      example = true;
    },
    calculate() {
      invalidate();
      const snapshot = Object.freeze(draftRows.map((row) => Object.freeze({ ...row })));
      const calculated = calculateHours(snapshot);
      if (calculated.ok) { result = calculated; notice = 'success'; }
      else { errors = calculated.errors; notice = 'invalid'; }
      return calculated;
    },
    report: () => result ? buildReport(result, locale) : '',
    async copy(writeText) {
      if (!result) return false;
      const report = buildReport(result, locale);
      const request = ++copyRequestId;
      const capturedRevision = revision;
      copyStatus = 'copying';
      let success = false;
      try {
        if (typeof writeText !== 'function') throw new Error('Clipboard unavailable');
        await writeText(report);
        success = true;
      } catch { success = false; }
      if (revision !== capturedRevision || copyRequestId !== request) return false;
      copyStatus = success ? 'copied' : 'copyFailed';
      return success;
    },
    pagehide() {
      invalidate('idle');
      draftRows = [];
      example = false;
    }
  };
}
