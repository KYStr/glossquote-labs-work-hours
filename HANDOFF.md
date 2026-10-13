# 工時加總交接

2026-10-13：SPEC_ONLY，主對話正建立完整規格。尚未建立原功能對話，尚無 runtime、測試結果、GitHub 或正式站。下一步：完成規格審查後實際開 chat，請求 gpt-6.1-sol/max，執行 M1/T00。

預定固定 origin https://hours.glossquote.com；公開 repo KYStr/glossquote-labs-work-hours。狀態全部 NOT_RUN，非存在聲明。

每次 append 任務 ID、範圍/非目標、改檔、命令/exit、環境 fingerprints、瀏覽器版本/觀察、PASS/FAIL/NOT_RUN、固定 source manifest、發布狀態、風險與下步。歷史不可改寫為新的 PASS。

## 2026-10-13 — THREAD-18-work-hours / M1-T00

狀態：**LOCAL_MVP_FROZEN_AWAITING_PRIMARY_ACCEPTANCE**，版本 0.1.0。M1 必要本機 gate 通過；實作者 owner 已釋放，程式凍結供主对話獨立驗收，未自行放行或執行 M2。完整交付 Goal 仍 active，未將發布、上線、首頁或外部驗收標 complete。

配置請求：create_thread 接受 `model=gpt-6.1-sol` / `thinking=max`；thread `01a1335f-7aad-7592-ac76-2110ddb83eed`，host local。這是主對話回傳的建立紀錄；backend 模型身份 **not-independently-confirmed**。

### 可操作交付与實際改檔

- 新增 `public/index.html`、`public/en/index.html`、`public/robots.txt`、`public/styles/app.css`。
- 新增 `public/js/core/work-hours.mjs`、`public/js/state.mjs`、`public/js/i18n.mjs`、`public/js/app.mjs`：嚴格整數分鐘／日期 API、區間重疊、開始日歸屬、整批才捨入、雙語 DOM、安全文字報告、revision/request ID 複製保護、pagehide/pageshow 清空。
- 新增 `scripts/validation.mjs`、`scripts/check.mjs`、`scripts/build.mjs`、`scripts/serve.mjs`、`scripts/manifest.mjs`；新增 `test/work-hours.test.mjs`、`test/ui-contract.test.mjs`、`test/tooling.test.mjs`，以及 `package.json`、`.gitignore`。零 runtime／開發套件安裝。
- 更新狀態 `project.json`、`START-HERE.md`、`HANDOFF.md`、`docs/RELEASE-CANDIDATE.md`；`dist/` 只生成八個 allowlist 靜態檔案，與 public 完全相同。沒有根 Git 操作、首頁、兄弟、根 AGENTS/.codex、部署或憑證讀取。

Product App / Operate 沿既有家族 tokens、工作表主體與可見欄位；使用 Impeccable 有界單方向，不引入新字型、視覺套件、interview 或子代理。一次桌面/320px 視覺檢查後，只修正英文單列計數語句為「1 of 62 entries」，再確認；沒有擴張功能或風格。使用 Sites 本機預覽路徑，不註冊或部署 Sites。

### 命令與版本

工作目錄為本工具；Node `v24.14.0`、npm `11.9.0`，產品 `0.1.0`。全部測試只合成資料，沒有第三方測試服務。

|命令|實際結果|證據檔（專用目錄下）|
|---|---|---|
|`npm test`|exit 0，41 PASS，0 FAIL/skip|`test-final.txt`|
|`npm run check`|exit 0，8 assets、兩語 parity、active references／API scan、8 helper/test syntax|`check-final.txt`|
|`npm run build`|exit 0，8 preview assets、noindex,nofollow|`build-final.txt`|
|`npm run dev`|正常服務中，127.0.0.1:4198，沒有 port fallback|owned session 39968，Node PID 81000|
|`node scripts/manifest.mjs`|exit 0，35 source files / 18 code files / 8 runtime / 8 dist|`source-manifest-final.json`|

最終三項 checks 在英文计數語句與 manifest helper 最終化後執行。保留 `*-attempt-1.txt` 歷史；初次亦全 PASS，沒有刪除或降低 gate。check 的安全掃描是輔助 A 證據，不宣稱取代真瀏覽器 Network／Storage 檢查。

### 固定版本與工具邊界

專用 append-only 證據：孵化器根 `.runs/work-hours/m1-20261013-01/`。固定完整 source/runtime/dist manifest 是 `source-manifest-final.json`；digests 亦記於 `final-summary.json`。現有 17 份規格的初始 hash 來自主對話 `.runs/new-tools-2026-10-13/spec-18.json`，數值及功能規格保持原樣；scope 比對见 `scope-comparison.json`。

- 18 個 implementation/code 檔案 digest：`361eb9b63226eb63a41003350831c64f4505e070f4c197eb96c96fee8449acef`。
- public 8 檔 digest：`bebb47dc26ace43a03dffbf56c68d37e81857878b89e69a8cc1170ac92c3e36f`；dist digest 相同，逐檔 bytes/hash 一致。
- server 僅 loopback，GET/HEAD、MIME、未知路徑真 404、POST 405、no-store 與 preview 安全 headers。真負例涵蓋 encoded traversal、hidden、祖先 junction、hardlink outside sentinel、unknown stale output、HTML 大小寫／引號／註解。未知輸出拒絕，沒有清空其他資料夾。

### A 與 B 分層結果

|層／範圍|結果與實際觀察|
|---|---|
|A 核心 W01–W22、W30|PASS；獨立精確 expected、Gregorian 日期、長度優先、strict grammar、62段89280分鐘、gross 重疊、排序與先加分鐘才捨入|
|A state W23–W27|PASS；增刪邊界、raw draft、所有編輯失效、完整 LF 報告、拒絕／缺失 clipboard provider、clear/pagehide 晚回與同 revision 逆序兩請求|
|A 工具鏈 W31、W32 preview|PASS；實際 HTTP、build bytes 與安全負例；production 部分 NOT_RUN（M2）|
|B 兩語 W01|PASS；手動載入假範例再計算，180+270=450，7 小時30分／7.50；每列、每日與報告一致|
|B 兩語 W03|PASS；2026-10-01 22:00→02:00、次日、休息30，gross240/net210/3.50，全歸10/01|
|B 兩語 W13|PASS；09–12 與11–13重疊，辨識原列1/2，無部分總計，focus第一列開始欄位|
|B 兩語 W24|PASS；成功後改第二列開始，結果立刻隱藏／清空，copy disabled，提示重算；跨日勾選與增刪亦觀察失效|
|B 其他觀察|中文 W04 未勾次日拒絕；兩語 W10 `9:00` 原稿保留、固定格式錯誤並 focus；英文 W23 鍵盤增刪；英文 W30 `<img onerror=alert(1)>` 日期固定拒絕、沒有 script dialog、無結果|
|B W25 手動 fallback|PASS 可選 readonly 報告：英文 Ctrl+A selection 0..532，與 length532一致；不宣稱原生 clipboard 成功／權限測量|
|B W27 導航返回|PASS 實際 back 回英文為今日、一空時段、無舊結果；是否真 BFCache persisted 未被工具暴露，該特定路徑 NOT_RUN|
|B W29 兩語320px／鍵盤|PASS 設定320×880，clientWidth305（scrollbar佔15）、scrollWidth305，無整頁水平 overflow；局部表格捲動；English clear後連續五次 Tab 到Add、Enter增刪，checkbox Space、calculate Enter；兩語 calculate Enter。viewport 已 reset|

真瀏覽器為 Codex In-app Browser，browser ID 2／自建 tab ID 1。工具提供真頁面 AX、DOM、JPEG 截圖；**完整 engine/browser version NOT_EXPOSED**，read-only DOM scope 不提供 navigator。自己的 tab error/warn log 為空陣列（`browser-console.json`）。不把工具自身未提供版本的查詢限制當產品 FAIL，也不虛構版本。

主要觀察檔：`browser-zh-W01/W03/W13/W24.txt`、`browser-en-W01/W03/W13/W24.txt`、`browser-zh-W03-full-dom.txt`、`browser-en-final-dom.txt`、`browser-en-320-keyboard-report-dom.txt`、錯誤／返回觀察，以及 `browser-acceptance.json`。截圖：`browser-zh-desktop-W01.jpg`、`browser-en-final-desktop.jpg`、`browser-en-320-W03.jpg`、`browser-zh-320-final.jpg`；較早英文320截圖尚顯示舊計數語句，最終重載 DOM／中文320與英文桌面確認已使用最終 runtime。

NOT_RUN／未聲稱：完整 Network/Storage/hidden `/cdn-cgi/rum` 觀察、原生系統 clipboard 寫入與 permission dialog、真正200% browser zoom、读屏、手機真機、其他引擎；B 的 W02/W05/W07/W11/W14/W15/W19/W21 未逐案執行（A 對應測試 PASS）。B頁面返回已實測，但 BFCache persisted 標記未觀察。這些不改成 PASS，不降低 M1 必要 gate。

主對話已另回報其 Edge 兩語 W01/W03/W13/W24 與英文 W10 符合預期，證據在其專用 `primary-m1/` 目錄；這是主對話的局部親驗回報，**不是最終 M1 放行**，本紀錄不替它宣稱後端版本、最終 hash 或 gate 通過。

### Windows 環境

guard 初始、首輪 build 後、最終 checks 後皆 PASS。`environment-before.txt` 與 `environment-final.txt` 的完整 Snapshots JSON **完全相同**（包含所有 Environment-key fingerprint／TEMP/TMP protected hashes）；比較見 `environment-comparison.json`。沒有任何持久環境修改。

|Scope|RegistryType／PATH長度／ephemeral數|PATH SHA256|完整 Environment-key SHA256|
|---|---|---|---|
|HKCU User|ExpandString / 834 / 0|`3efe0b0eba15a12d5555fb191a204ce0048f87381d73108bac1d6d5d05b67ffb`|`3a36b632b9e0143f2ff2b9e1c5b964e89bf192a4a3aa3ebc93ea8d0314ee7e5a`|
|HKLM Machine|String / 1227 / 0|`52d7cb0c3e02b67714f1b0caefc8f92d5d2c365bb2513dc537d42207d8b56eb8`|`a0f49688069fd5a21146e94fd22764caedcd3ffbe25dc60c716a6a398673ac82`|

### 預覽、風險與下一步

中文 `http://127.0.0.1:4198/index.html`；English `http://127.0.0.1:4198/en/index.html`，實際 HTTP 200/text-html；`/missing.html` 真404/text-plain。自建 dev 保留供主驗，PID81000，StartTime 2026-10-13 12:05:46 +08:00；其他 tabs/services未操作。自己的英文頁保留為 handoff，沒有讀 clipboard、既有 browser profile 或私人資料。

目前必要 gate 沒有已知 FAIL；人工能力缺口如上。普通鐘面計算限制已常駐呈現，未承諾薪資／法規／DST。主對話待決策只為 M1 獨立驗收／M2 放行；若有具體 in-scope 問題，返回本原 owning chat 修正。

GitHub/source commit/ZIP、production SEO／正式404配置、freeCloudflare hosting、首頁整合、external review **NOT_RUN**，本輪不得前進；目標 repo/正式 URL 仍是候選。沒有缺少重複發布許可的阻塞，也沒有自行部署。凍結後不再自行改 code，等待主對話驗收。

## 2026-10-13 — WH-M2-T01 開始

主對話正式派工：M1 實際主驗 PASS，獨立固定 copy 的41/41、check/build、真Edge兩語W01/W03/W13/W24及英文W10、source35/code18/runtime8/dist8 hashes、完整Environment snapshots皆符合M1凍結版。主驗報告位於孵化器根 `.runs/new-tools-2026-10-13/primary-m1/hours-primary-acceptance.md`。

原功能對話目前只執行 TASKS M2：固定正式 SEO/404/headers、production build/check、static Workers config/offline dry-run、独立 PUBLIC source及Git blob-byte ZIP。已存在GitHub/free Cloudflare授權；不讀token、不自行部署或修改首頁，不改演算法或規格門檻，不加依賴/付費/再委派。新的 append-only 證據在 `.runs/work-hours/m2-20261013-01/`；先前M1證據保留原樣。配置請求Sol/max已接受，backend身份仍未獨立確認。

### M2 本機候選 gate — 來源發布前

Node v24.14.0/npm11.9.0；`npm test`48/48 PASS、0 FAIL/skip；`npm run check`、`build`、`build:production`、`check:production` exit0。Preview10/production11檔。既有Wrangler4.147.0的實際`deploy --dry-run --autoconfig=false`exit0，沒有上傳，所有CLI home/config/cache/temp/log及工作副本在新的task-owned state內，不繼承credentials；沒有安裝套件。前後完整Windows Environment Snapshots相同。

新發布層只改build/check/validation/serve/manifest與package scripts，增加release-contract、dry-run、source-files、source-archive helper、release.test、404/_headers/wrangler配置及文件狀態。計算核心/state/app/i18n/CSS與原兩語publicHTML沒有改動；正式metadata由build產生，不把來源preview改成可索引站。

Production固定origin及兩語self canonical/zh-Hant/en/x-default、OG、WebApplication JSON-LD、兩頁sitemap和Allow robots；CSP只允許兩份JSON-LD的精確SHA-256，沒有unsafe-inline/eval。靜態Workers設定html_handling none/404-page、workers.dev/preview URLs關閉、observability logs/traces關閉。_headers不作網頁asset提供。

48測試包括實際loopback production HTTP/MIME/HEAD/404/header、preview/prod切換、meta-refresh各種大小寫/引號拒絕且舊dist不被改寫、sitemap/CSP/JSON-LD/新capability負例、Git blob-byte archive與CRC/path traversal。純production候選server `http://127.0.0.1:52344/`（4198占用而使用OS port，保留M1 server），owned session47937/PID45820；M1 session39968/PID81000仍在。

真IAB自建tab2：兩語讀取DOM canonical/alternates/robots/JSON-LD，載範例再計算450分鐘/7.50，英文修改break後舊結果清空/copy停用；實際404有兩語返回入口且可返回英文工具，error/warn logs空陣列。Browser engine version未暴露。這是本機production候選，不是正式Cloudflare live證據；先前人工Network/Storage/nativeclipboard/真zoom/讀屏/手機等NOT_RUN保留。

此段時點：必要本機候選PASS，43檔reviewed copy已建立，GitHub/固定ZIP驗證尚待執行；後續來源發布紀錄另append，不改寫歷史。公開copy只含source whitelist，不含dist/.runs/node_modules/Git metadata/輸入/secret，沒有自行加入license。

### M2 首次來源發布 — 2026-10-13

實際公開repo：[KYStr/glossquote-labs-work-hours](https://github.com/KYStr/glossquote-labs-work-hours)，GH API確認owner KYStr/visibility PUBLIC，remote HEAD與`codex/work-hours-release`指向 **`03b1c7bb56237d94b59d3cf94cbea4534d61fb7e`**。這是已驗實作commit，43檔逐Git blob bytes與本工具 source 一致（`reviewed-first-commit.json`）；只在獨立reviewed copy初始化/提交/push，沒有force、根Git或新credential權限。

本次採codex/分支前綴，commit用已驗public GitHub account ID的noreply email，未讀私人email或印token；未加license。首次push成功後紀錄真實PUBLIC/SHA，再以僅文件/狀態變更的commit保存此紀錄。最終publication HEAD與ZIP不在待生成的commit內自我引用；會在宿主最新HANDOFF与專用外部manifest紀錄。當前ZIP/解壓候選驗證尚待執行，hosting/home/external review未執行。
