# 工時加總任務

SPEC_ONLY。一次一個里程碑，完成凍結回報主對話；必要失敗不前進。不遞迴委派。共通允許本工具HANDOFF/project.json/START-HERE/docs/RELEASE-CANDIDATE狀態更新，以及TASK-ENTRY專用append-only證據；不改兄弟/首頁/根repo。

## M1 / T00：完整本機可操作MVP

前置：讀入口、產品/核心/UX/驗收/工程隱私；Node24與持久環境guard；記錄初始狀態。allowed本工具public/**、scripts/serve.mjs/check.mjs/build.mjs/validation.mjs等必要自包含工具helper、test/**合成資料、package.json/.gitignore、dist生成物。不改規格數值/功能門檻，不加依賴。

步驟：1 純日期/時間/休息/重疊/分鐘API及独立expected測試；2 雙語工作表、範例、錯誤/舊結果失效、copy fallback与競態；3 真安全server/check/previewbuild与負例；4 真browser指定主要流程、320px/zoom能力分層；5最終必要checks與固定manifest，Handoff、owner釋放。必要命令由此前建立後執行 `npm test`、`npm run check`、`npm run build`；不可用空script假通過。

驗收以ACCEPTANCE M1 gate、可操作產物和前後guard不變。非目標：正式SEO、GitHub、部署/首頁、工資或其他需求。停止：未知系統漂移、同檔別人寫、需要額外權限/成本/依賴、規格矛盾、兩輪同失敗無新線索；scope內缺陷要修且測不需重問。完成停在M1供主驗，主驗通過才M2。

## M2 / T01：發布準備與獨立PUBLIC來源

前置主代理實際放行M1。allowed本工具public固定SEO/404/_headers，scripts release/build/check/manifest helper、test/release.test.mjs、wrangler.jsonc、package scripts、docs/RELEASE*及TASK-ENTRY reviewed source copy。固定origin，preview/prod隔離、release/404/MIME/security驗證、Git blob bytes ZIP與解壓重build。

依docs/RELEASE，建 `npm run build:production`、`npm run check:production`；test/check/preview/prod與dryrun必要checks通過後沿既有gh權限公開KYStr/glossquote-labs-work-hours（無force），驗證PUBLIC/remoteSHA與固定sourceZIP，交READY_FOR_INTEGRATION或具體BLOCKED。不要读token/自行deploy。根repo/首頁不能改。

## M3 / T02：主代理整合與外部複驗

原chat不得自行執行：主對話讀實際diff/固定source，獨立驗收、免費Cloudflare發布https://hours.glossquote.com、兩語live/HTTP/SEO/主要流程，verified才更新/發布兩語首頁。原chat僅按主對話具體問題在本工具owning paths修正與重publish。

上線標AWAITING_EXTERNAL_REVIEW。使用者/驗收者必要回報修正後重新主驗/publish/deploy並外部確認才完成。未收到回報先保留，不創造推測返工或假PASS。
