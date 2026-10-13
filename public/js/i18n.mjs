export const copy = {
  'zh-Hant': {
    entry: '時段', fields: { date: '開始日期', start: '開始時間', end: '結束時間', nextDay: '結束在次日', breakMinutes: '休息分鐘' },
    dateHint: 'YYYY-MM-DD，例如 2026-10-01', timeHint: 'HH:MM，例如 09:30', breakHint: '整數分鐘，例如 30',
    remove: '移除', rowCount: '段 / 最多 62 段；至少保留 1 段',
    idle: '填入開始與結束時間，再加總。', changed: '資料已變更，請重新加總。',
    example: '已載入假資料範例。按「加總工時」取得結果。',
    invalid: '請修正下列問題，再加總工時。', success: '工時已加總：',
    totalMinutes: '總分鐘', decimal: '十進位小時', daily: '每日小計', details: '每段明細',
    date: '開始日期', duration: '工時', decimalUnit: '小時', minuteUnit: '分鐘',
    nextDay: '次日', sameDay: '當日', period: '開始 → 結束', gross: '原始', rest: '休息', net: '工時',
    report: '完整文字報告', reportHint: '可直接選取文字，手動複製。清除頁面不會刪除系統剪貼簿。',
    copying: '正在複製報告…', copied: '報告已複製。', copyFailed: '無法直接複製，請選取下方文字。',
    errors: {
      ROWS_COUNT: '請保留 1 至 62 段時段。', ROW_SCHEMA: '時段欄位不完整，請清除後重新填入。',
      DATE_REQUIRED: '請填入開始日期。', DATE_LENGTH: '日期輸入不得超過 32 個字元。',
      DATE_FORMAT: '使用 YYYY-MM-DD，例如 2026-10-01。', DATE_RANGE: '請填入 2000–2099 年間存在的日期。',
      TIME_REQUIRED: '請填入時間。', TIME_LENGTH: '時間輸入不得超過 16 個字元。',
      TIME_FORMAT: '使用 HH:MM，例如 09:30（00:00–23:59）。',
      BREAK_REQUIRED: '請填入休息分鐘；沒有休息則填 0。', BREAK_LENGTH: '休息輸入不得超過 16 個字元。',
      BREAK_FORMAT: '休息請填整數分鐘，例如 30；沒有休息則填 0。', BREAK_RANGE: '休息必須是 0 至 1440 的整數分鐘。',
      END_ORDER: '結束時間須晚於開始時間；若跨日，勾選「結束在次日」。',
      SPAN_LIMIT: '單段最多 24 小時，請確認次日與起迄時間。',
      BREAK_EXCEEDS_SPAN: '休息不能超過這段時段的原始分鐘。',
      ROW_OVERLAP: '時段重疊，請修正，避免重複計入。', INVALID_RESULT: '請重新加總工時。'
    }
  },
  en: {
    entry: 'Entry', fields: { date: 'Start date', start: 'Start time', end: 'End time', nextDay: 'Ends next day', breakMinutes: 'Break minutes' },
    dateHint: 'YYYY-MM-DD, e.g. 2026-10-01', timeHint: 'HH:MM, e.g. 09:30', breakHint: 'Whole minutes, e.g. 30',
    remove: 'Remove', rowCount: 'of 62 entries; keep at least 1',
    idle: 'Enter start and end times, then calculate hours.', changed: 'Entries changed. Recalculate after changes.',
    example: 'Fictional example loaded. Select “Calculate hours” to get the result.',
    invalid: 'Correct these entries, then calculate hours again.', success: 'Hours calculated:',
    totalMinutes: 'Total minutes', decimal: 'Decimal hours', daily: 'Daily totals', details: 'Entry details',
    date: 'Start date', duration: 'Net duration', decimalUnit: 'h', minuteUnit: 'min',
    nextDay: 'next day', sameDay: 'same day', period: 'Start → end', gross: 'Gross', rest: 'Break', net: 'Net',
    report: 'Full text report', reportHint: 'Select this text to copy manually. Clearing this page does not erase the system clipboard.',
    copying: 'Copying report…', copied: 'Report copied.', copyFailed: 'Unable to copy directly. Select the report below to copy manually.',
    errors: {
      ROWS_COUNT: 'Keep between 1 and 62 entries.', ROW_SCHEMA: 'Entry fields are incomplete. Clear and enter them again.',
      DATE_REQUIRED: 'Enter the start date.', DATE_LENGTH: 'Date input must be 32 characters or fewer.',
      DATE_FORMAT: 'Use YYYY-MM-DD, e.g. 2026-10-01.', DATE_RANGE: 'Enter a valid date between 2000 and 2099.',
      TIME_REQUIRED: 'Enter the time.', TIME_LENGTH: 'Time input must be 16 characters or fewer.',
      TIME_FORMAT: 'Use HH:MM, e.g. 09:30 (00:00–23:59).',
      BREAK_REQUIRED: 'Enter break minutes; use 0 for no break.', BREAK_LENGTH: 'Break input must be 16 characters or fewer.',
      BREAK_FORMAT: 'Use whole break minutes, e.g. 30; use 0 for no break.', BREAK_RANGE: 'Break must be a whole number from 0 to 1440 minutes.',
      END_ORDER: 'End time must follow start time. Select “Ends next day” for overnight work.',
      SPAN_LIMIT: 'Each entry is at most 24 hours. Check next day and the start and end times.',
      BREAK_EXCEEDS_SPAN: 'Break minutes cannot exceed this entry’s gross minutes.',
      ROW_OVERLAP: 'These entries overlap. Correct them to avoid counting time twice.', INVALID_RESULT: 'Calculate hours again.'
    }
  }
};

export function errorText(error, locale) {
  const text = copy[locale];
  if (error.code === 'ROW_OVERLAP') {
    const [a, b] = error.rowIndexes.map((index) => index + 1);
    return locale === 'zh-Hant' ? `時段 ${a} 與時段 ${b} 重疊，請修正，避免重複計入。` : `Entries ${a} and ${b} overlap. Correct them to avoid counting time twice.`;
  }
  const prefix = error.rowIndex === undefined ? '' : `${text.entry} ${error.rowIndex + 1}${locale === 'zh-Hant' ? '：' : ': '}`;
  return prefix + (text.errors[error.code] ?? text.errors.INVALID_RESULT);
}
