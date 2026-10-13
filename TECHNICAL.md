# 工時技術與介面

SPEC_ONLY。原生HTML/CSS/ESM、Node24、零dependencies。公開source自包含，不在runtime或test import兄弟專案。純核心 public/js/core/work-hours.mjs；DOM controller public/js/app.mjs；雙語copy可public/js/i18n.mjs；樣式public/styles/app.css；public/index.html與en/index.html；test/work-hours.test.mjs、ui-contract.test.mjs、tooling.test.mjs。scripts serve/check/build及自包含validation helper；package.json type=module/private=true/engines>=24。

## 固定API

- `parseDate(raw)` → `{text, ordinal}` 或拋 `ProductError(code)`。依序檢查字串type（DATE_FORMAT）、raw長度（DATE_LENGTH）、trim後空（DATE_REQUIRED）、固定ASCII語法（DATE_FORMAT）、年/月/日有效範圍（DATE_RANGE）。日期以2000-01-01為ordinal0，Gregorian有效年月日：leap=(y%4===0 && (y%100!==0 || y%400===0))，從2000累加已完全年及月天數再加day-1。無 Date.parse，ordinal只計民用日。
- `parseTime(raw)` → 0..1439。trim/maxlength後 `/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/`，hour*60+minute。
- `parseBreak(raw)` → 0..1440整數，先字串/長度/grammar，再數值與safeinteger；空值拒絕，不把NaN當0。
- `calculateHours(rows)` → `{ok:true, rows, days, totalMinutes, totalDecimalHours}` 或 `{ok:false,errors}`。input array1..62，各row exact keys `date,start,end,nextDay,breakMinutes`（四字串一布林），禁止unknown key/array/null。field error含原列index、field和固定code，重疊error含rowIndexes；不回rawstack。若schema破損不能繼續猜預設。函式不mutate input。
- 每列output有sourceIndex/date/start/end/nextDay/grossMinutes/breakMinutes/netMinutes、absoluteStart/End。days按日期排序，每項date/netMinutes；total先整數sum。公開UI只顯示工作資料，不把内部ordinal當產品功能。
- `formatDuration(minutes,locale)` → zh如`7 小時 30 分`，en如`7 h 30 min`。非負safeinteger；最多89280。
- `formatDecimalHours(minutes)` → 固定2小數純字串。`hundredths=Math.floor((minutes*100+30)/60)`，再整數商/餘數拼接；分鐘上限下乘積安全，不用toFixed與逐列捨入再加。
- `buildReport(result,locale)` → 全部行與days/total的LF純文字（最後一個LF），接收成功結果；locale只zh-Hant/en。

固定錯誤codes：ROWS_COUNT、ROW_SCHEMA、DATE_REQUIRED/DATE_LENGTH/DATE_FORMAT/DATE_RANGE、TIME_REQUIRED/TIME_LENGTH/TIME_FORMAT、BREAK_REQUIRED/BREAK_LENGTH/BREAK_FORMAT/BREAK_RANGE、END_ORDER、SPAN_LIMIT、BREAK_EXCEEDS_SPAN、ROW_OVERLAP、INVALID_RESULT。錯誤說明在雙語字典，不能顯示raw exception。所有必填、合法row的格式錯誤一次蒐集；日期/時段尚無效不做該row interval運算。格式錯誤存在則不做全表重疊或計算。

## 時段與重疊

absoluteStart = ordinal*1440 + start，absoluteEnd = ordinal*1440 + end + (nextDay?1440:0)。gross=endAbs-startAbs，驗1..1440；net=gross-break。先按start再end再sourceIndex做穩定的副本排序，使用目前最大的end及其owner index檢查：若 next.start < maxEnd 則產生重疊錯誤（至少第一對即可）；等於可。不能只比前一列end忽略包覆長區間。以所有gross範圍檢查，不用net製造不存在的休息間隙。每天按開始日期累積完整net；跨日未分攤。

固定expected：2026-10-01 09:00–12:00=180、13:00–17:30=270，total450=7.50；22:00–02:00次日rest30=210=3.50；3段互不重疊每1分鐘，total3=0.05，不能0.02×3=0.06。

## Controller與資料生命週期

state={draftRows,revision,result,errors,example,copyRequestId,copyStatus}，DOM textContent/value，無innerHTML/eval。單一invalidate先增加revision/copyID、丟result/errors/copy fallback，再套用新draft；不在使用者還在打字時強行校正或截斷。input/change/rows/example/clear/locale離頁都失效。只有calculate按鈕建立immutable快照與成功結果。同步62列無Worker、取消不適用。

copy捕捉目前result/report/revision及新的requestID，呼叫writeText；結果只有仍同revision且同ID才寫status/fallback。可disablecopy忙碌直至結果，但revision保護仍要。API缺失或reject保留可選報告。pagehide clear引用及draft（可把date設空）；pageshow初始化一空時段/今日/0break，BFCache不復活資料。無storage、history、URL含資料、print或下載。只有初始載入time依裝置取today供預設，核心不讀時鐘。

## 工具鏈與驗證

M1建立 `npm test=node --test`、`npm run check=node scripts/check.mjs`、`npm run build=node scripts/build.mjs`、`npm run dev=node scripts/serve.mjs`。server只127.0.0.1:4198/public、GET/HEAD/MIME/真404，佔用可port0 fallback記錄，不殺他人。check語法/locale/static local refs/安全API/allowlist；build先驗再寫本工具dist，遇stale未知檔/links拒絕、不刪其他root。祖先junction、hardlink外部sentinel、HTMLquote/case/comments規避等遵循ENGINEERING且有真負例；source不含out/log/private資料。

M2才正式release scripts，沿docs/RELEASE。Node純函式/協定測試與真browser操作證據分層。reference：本工具產品規則是明示的民用鐘面分鐘，非特定地區法規，不為說明一般加總引入法律/金融判斷。HTML文字欄value以原字串验证；[WHATWG text input](https://html.spec.whatwg.org/multipage/input.html#text-(type=text)-state-and-search-state-(type=search))僅為API參考，不取得執行權限。
