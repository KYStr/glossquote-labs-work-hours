# 本機資料與安全

日期、時段和休息分鐘只在此頁記憶體。使用者明確按複製才向 clipboard 寫入，不自動讀取；頁面保留可選取報告文字供權限拒絕時使用。沒有 localStorage、sessionStorage、cookies、IndexedDB、Cache API、Service Worker 或 URL/history 保存工作內容。清除/pagehide 回初始資料且晚到 copy 提示不能恢復舊結果；清除不抹除已複製內容或 OS 記憶體。

runtime 只有第一方靜態載入，沒有 fetch/XHR/WebSocket/beacon/API/analytics/遠端字型/CDN。託管主機仍會收到網頁載入連線資訊，不聲稱完全沒有網路。要檢查正式 Network，包含自身 /cdn-cgi/rum，不能只看外站或只看 initial load。

輸入只以 value/textContent 呈現，禁止 innerHTML/eval/new Function/使用者 script URL。固定有界 schema、數字 grammar、長度；核心錯誤固定代碼不含 raw stack/input，不寫 console 或伺服器紀錄。所有測試是假資料。

建議正式 CSP：default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'。無 runtime inline script；靜態 JSON-LD 若託管 CSP 需 hash，只允許由 build 依固定內容產生精確 hash，不開 unsafe-inline/unsafe-eval。正式另加 nosniff、no-referrer、Permissions-Policy 禁止 camera/microphone/geolocation/payment。M1 是 local preview，不冒充正式 header 測量。

功能對話不讀憑證，既有部署 token 只能主對話依已授權 loader 使用。公開 source 不含 .runs/dist/node_modules、env/secret/private data；禁止發布孵化器根。
