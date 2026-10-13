# 工時加總發布契約

M1 不發布；主驗通過後 M2 製作正式建置及公開来源，主對話 M3 部署和首頁整合。既有 GitHub/free Cloudflare 授權有效，不需重問。PUBLIC repo 是來源可見性，不是擅自選定開源 license 的授權。

固定 origin https://hours.glossquote.com。中文 /index.html、英文 /en/index.html 的 self canonical；兩頁各含 zh-Hant/en/x-default，x-default 中文。title/description/H1/OG locale/url 與可見說明對應，WebApplication JSON-LD 不捏造評分。sitemap 只列兩 canonical，robots 指固定 sitemap。preview 預設 noindex,nofollow、Disallow:/，不能混入可索引正式資料。

M2 建立 build:production/check:production，固定 origin allowlist，不由訪客 Host/query 決定 SEO。靜態 Workers 只部署已審查 dist；404 真正狀態碼且無 SPA fallback；正常 HTML/CSS/JS/XML/TXT MIME，header 配合隱私契約。不在伺服器計算輸入。

PUBLIC https://github.com/KYStr/glossquote-labs-work-hours 使用獨立 reviewed copy、必要 checks 後提交，無 force 或根 repo 操作。只白名單本工具 public/scripts/test/package/config/必要 docs。source 不包含輸入、秘密、測試證據私檔、其他工具或 build/cache。

交接 remote visibility/HEAD、source tree/blob bytes manifest、production manifest、命令/exit/環境/NOT_RUN，並用 git -c core.autocrlf=false archive 或等價方式生成固定 commit ZIP；實際解壓逐 Git blob 核對，從解壓副本 build/check。不能改 Git global/system 設定，也不能只驗 ZIP 雜湊就宣稱來源一致。

主對話驗收候選後序列部署、驗雙語正式操作/HTTP/安全/SEO，再新增首頁 published 項並發布/驗兩語首頁。本工具不得自行修改首頁。已上線仍是 awaiting external review，待使用者或驗收者確認才完成該版本。

## M2 實作路徑 — 2026-10-13

`scripts/release-contract.mjs` 保存固定 origin、兩語 metadata、精確 JSON-LD/CSP hashes、sitemap、robots、headers 與 Worker config 契約。public 保留 preview；`build.mjs --production` 只轉換兩頁 head、robots、_headers，新增 sitemap，其餘 runtime bytes 沿用原檔。preview 10 檔、production 11 檔，各由對應驗證器檢查，不能混用。

`wrangler.jsonc` 使用 assets-only、`html_handling: none`（保留明確的 index.html URL）、`not_found_handling: 404-page`，沒有 SPA fallback；只配置 hours.glossquote.com，workers.dev/preview URLs 關閉。沒有 account ID、vars、secrets、資料 bindings 或 Worker 執行入口。logs/traces 明確停用是既定 PRIVACY-SECURITY 契約對第三方技能預設 observability 的優先要求；不自動開啟 telemetry。

採用且核對的官方資料：[HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)、[custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)、[static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)、[Wrangler deploy dry-run](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)。既有 CLI 4.147.0 help 和 installed schema 為版本基準；不因技能預設添加依賴或讀取 credential。

`scripts/dry-run.mjs` 必須使用現有 Wrangler 絕對路徑與全新的隔離 state 目錄；CLI 的工作副本/產物/log/home/cache/temp 都留在該目錄，不污染 source，也不繼承 credential variables。actual deploy 仍由主對話在 M3 的已授權 loader 完成。

`scripts/source-files.mjs` 定義43個公開自包含 source 檔案；`source-archive.mjs` 對固定40字元 commit執行 local Git archive，驗 EOCD commit、中央/本地項目、路徑/大小/CRC及每項 Git blob bytes，僅在全部符合後建立新 ZIP/解壓目錄。來源 manifest、remote PUBLIC/HEAD、ZIP sha、解壓 tests/build/check 及人工 NOT_RUN 的實際證據見 HANDOFF。
