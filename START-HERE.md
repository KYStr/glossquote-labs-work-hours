# 工時加總開工入口

2026-10-13：M1/T00 已由主對話獨立驗收 PASS，WH-M2-T01 已正式放行，目前由原功能對話製作發布候選；正式部署及首頁仍待主對話 M3。實際證據見 HANDOFF 與 project.json。

先讀 [AGENTS](AGENTS.md)、[TASK-ENTRY](TASK-ENTRY.md)、[PRODUCT](PRODUCT.md)、[TECHNICAL](TECHNICAL.md)、[UX-SEO](UX-SEO.md)、[ACCEPTANCE](ACCEPTANCE.md) 與 [TASKS](TASKS.md)。依 [隱私](docs/PRIVACY-SECURITY.md)、[工程](docs/ENGINEERING.md) 和 [設計](docs/DESIGN-SYSTEM.md) 實作。

目前只授權 M1/T00：可操作的雙語本機 MVP、純計算精確測試、真正 dev/check/preview build。不是停用按鈕的空骨架。完成後凍結實作並回報主對話，主驗通過再放行 M2 來源發布/正式建置。M3 由主對話序列部署及首頁整合；收到外部驗收才結案該版本。

命令在本工具目錄執行：`npm test`、`npm run check`、`npm run build`；T00 建立後可 `npm run dev`（預設 http://127.0.0.1:4198/）。M2 才建立 `npm run build:production` 與 `npm run check:production`。尚不存在的命令不是已通過的證據。
