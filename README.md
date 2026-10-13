# 工時加總

版本 0.1.0，2026-10-13。本機雙語工具與正式發布候選已實作；M1 通過 owner 和主對話獨立驗收。來源發布、實際上線和外部驗收分開記錄於 [HANDOFF](HANDOFF.md)。

給需要整理打工、接案或日常工作時間的人：填開始、結束與休息分鐘，得到每段、每天和整批工時，可複製貼到自己的紀錄。支援同一天多段與明確勾選跨日，並拒絕重疊時段，避免不小心重複加總。

需求價值是待驗證假設，不捏造搜尋量。替代方案是紙筆、試算表或計時App；本工具不要求建表或持續計時，適合事後整理現有時段。與日期差工具相比，它處理多段分鐘、休息及重疊，與專注計時相比不需要倒數或歷史記錄。

難度中：零 runtime 依賴、固定整數分鐘，主要維護點為日曆驗證、跨日重疊、雙語表單和複製競態。沒有薪資、加班法規、稅務、定位打卡、帳號、雲端同步、時區/DST修正或檔案匯入。

先讀 [START-HERE](START-HERE.md)，再依 [TASKS](TASKS.md) 推進。M1 是本機可操作雙語版本，M2 是來源及發布準備，M3 由主對話發布整合；每階段通過才前進。

## 本機使用 / Local use

Node.js 24+。完整離線測試的固定來源 ZIP 回歸另需 Git；沒有 npm dependencies，不需安裝套件。

```text
npm test
npm run check
npm run build
npm run dev
```

開啟命令印出的 loopback URL；預設 `http://127.0.0.1:4198/index.html` 和 `/en/index.html`。若 port 占用，server 使用 OS 分配的新 port，保留占用者。來源 public 與 `npm run build` 都維持 noindex，範例是假資料且需手動按計算。

## 正式候選 / Production candidate

```text
npm run build:production
npm run check:production
node scripts/manifest.mjs --production
```

正式 metadata 只取固定 `https://hours.glossquote.com/index.html` 和 `/en/index.html`，不是訪客的 Host/query。此命令覆寫本工具的已知 generated dist，拒絕 unknown stale assets、junction/symlink 和 hardlinked 檔案。切回 preview 時只移除已知 generated sitemap，不清理其他目錄。

現有 Wrangler 4.x 可以執行不部署的 compile check，需提供其絕對 CLI 路徑，以及**尚不存在**的 task-owned 絕對 state 目錄：

```text
npm run dry-run -- --wrangler "<installed-wrangler>/bin/wrangler.js" --state-dir "<new-absolute-task-owned-state-directory>"
```

helper 將已驗 dist/config 複製到該新目錄，使用隔離的 home/config/cache/temp、關閉 metrics 和 autoconfig，不繼承 credential variables。不安裝 Wrangler、不讀既存登入、不上傳或部署。dry-run 通過只證明本機配置和打包；M3 才由主對話驗證實際 Cloudflare HTTP/SEO/操作與首頁。

本機檢查正式候選可執行 `node scripts/serve.mjs --production`；它提供 dist、真 404 和候選 headers，仍僅 loopback。兩語可見 FAQ 與 WebApplication JSON-LD 一致，CSP 只放行兩份精確 JSON-LD hashes，未使用 unsafe-inline/eval。

固定 Git commit ZIP 的驗證與解壓：

```text
node scripts/source-archive.mjs --repository "<absolute-reviewed-repository>" --commit "<40-character-commit>" --archive "<new-absolute-zip-path>" --extract "<new-absolute-extraction-directory>"
```

helper 只接受 `scripts/source-files.mjs` 的 source 白名單，先比 ZIP 每個檔案與真正 Git blob bytes，再建立新 ZIP/解壓目錄；從解壓副本重新執行上述 test/check/preview/production gates。ZIP 不含 dist、快取、.runs、node_modules、Git metadata 或私人測試證據。

公開來源審閱目標：[KYStr/glossquote-labs-work-hours](https://github.com/KYStr/glossquote-labs-work-hours)。正式 URL 是部署候選，公開 source 不表示正式站已部署；上線後仍需外部驗收。
