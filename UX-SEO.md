# 工時加總介面與SEO

SPEC_ONLY，Product App / Operate。人正在把零散出勤時段整理成可抄用總時数；主要物件是時段工作表及總計。沿docs/DESIGN-SYSTEM，暖紙/墨字/少量acid主按鈕，系統字型，無SaaS hero。頻繁欄位全部可見，跨日checkbox貼結束時間，休息明確寫分鐘；進階規則只放說明，不藏必需流程。

桌面：
```text
GlossQuote / 工時加總                          English
填入時段，算出總工時。 [載入範例]
日期         開始    結束    次日    休息(分)   移除
[YYYY-MM-DD] [HH:MM] [HH:MM] [ ]      [0]       [...]
[新增時段]                 [清除] [加總工時]
總共 7 小時 30 分（7.50 小時）           [複製報告]
每日小計 / 每段明細 / 可選文字報告
跨日歸開始日；鐘面時間，未做夏令時間調整
用法、隱私、FAQ
```
手機：
```text
工時加總        English
時段1：日期
開始     結束 [次日]
休息分鐘      移除
[新增] [計算]
總時分 / 每日小計
每段明細（必要時區域捲動）
[複製] 可選文字
```

空態「填入開始與結束時間，再加總。」；更改「資料已變更，請重新加總。」；格式「使用 HH:MM，例如09:30。」；順序「結束時間較早；若跨日，勾選『次日』。」；重疊「時段1與時段2重疊，請修正，避免重複計入。」；copy拒絕「無法直接複製，請選取下方文字。」不rawstack、不把部分結果當完整。English equivalents必須完整：Enter start and end times / Recalculate after changes / Use HH:MM / Select next day for overnight work / These entries overlap / Select the report to copy manually。

日期/開始/結束/休息皆明確label，空白不default0；錯誤aria-describedby，提交後focus第一錯誤；刪除後focus相鄰列可用控制。結果一次polite通知總計，不每鍵吵讀屏。普通文字4.5:1，控件3:1，44px主要target，320px與200%實測；無謎樣圖示，reduced-motion無裝飾動畫。

## 雙語內容

中文title：工時加總：扣除休息、跨日與每日小計 | GlossQuote
中文description：填入工作日期、開始與結束時間及休息分鐘，在瀏覽器本機加總每段、每天與整批工時。支援跨日並提醒重疊時段，無需帳號。
中文H1：工時加總。說明：不用把分鐘換成小數；填入各段時間、扣除休息，就能取得時分與十進位小時計。

English title: Work Hours Calculator: Breaks & Overnight Shifts | GlossQuote
Description: Add work intervals and deduct breaks locally in your browser. See entry, daily and total hours, handle overnight shifts and catch overlapping entries without an account.
H1: Work Hours Calculator. Intro: Enter your work intervals and breaks. Get hours and minutes plus decimal hours without converting each entry yourself.

兩語至少四個可見FAQ：
1. 如何計算跨日？勾次日，單段最多24小時，全部歸開始日。/ Select next day; a single interval is at most 24 hours and belongs to its start date.
2. 為何重疊不給總計？避免同一分鐘算兩次；休息未含起迄不能用來移除重疊。/ Overlaps are rejected to avoid counting time twice; break totals do not specify a break interval.
3. 7.50代表7小時50分嗎？不是，是7小時30分；時分另列。/ No. 7.50 decimal hours equals 7 hours 30 minutes.
4. 工資或夏令時間有算嗎？沒有；只算輸入的鐘面時間，不決定薪資/法律出勤。/ It totals entered clock times, without pay rules, time-zone or daylight-saving adjustments.
5. 資料有保存嗎？只在頁面記憶體，離頁清空，copy由使用者發起。/ Entries stay in this page; leaving clears them, and copying requires your action.

## 發布SEO

預覽兩頁noindex,nofollow、robots Disallow:/；M2 production固定 https://hours.glossquote.com/index.html 與 /en/index.html，self canonical + zh-Hant/en/x-default互返（default中文），lang/og/兩語首頁一致。visibleFAQ不承諾搜尋rich result；可見WebApplication JSON-LD、applicationCategory=UtilitiesApplication、operatingSystem=Web，不偽造評分。robots/sitemap/404/CSP與實際HTTP由docs/RELEASE約束。首頁draft直到主驗正式發布確認後改published，不能將候選當可用網站。
