# 工時加總驗收

SPEC_ONLY，以下全部產品NOT_RUN。A=Node核心/工具鏈、B=真瀏覽器，不互相替代。測試只假資料。所有時間未註明均2026-10-01，同日、rest0。

|ID|需求|層|輸入或動作|精確預期|
|---|---|---|---|---|
|W01|FR01,05|A+B|09:00–12:00；13:00–17:30|180+270=450，7小時30分/7.50，每日450|
|W02|FR03|A+B|09:00–18:00 rest60|gross540，net480，8.00|
|W03|FR03,05|A+B|22:00–02:00 次日 rest30|gross240，net210，3.50，全歸10/01|
|W04|FR03|A+B|22:00–02:00未勾次日|END_ORDER，無結果|
|W05|FR03|A+B|09:00–09:00同日/次日|同日拒絕；次日1440/24.00|
|W06|FR03|A|09:00–10:00 次日|SPAN_LIMIT1500>1440|
|W07|FR02|A+B|2024-02-29、2023-02-29|前者有效，後者DATE_RANGE|
|W08|FR02|A|2000-02-29、2100-02-29、2026-04-31|僅第一有效；2100超輸入年範圍；4/31無效|
|W09|FR02,03|A|2099-12-31 23:00–01:00次日|120分鐘，仍歸2099-12-31|
|W10|FR02|A+B|9:00/24:00/12:60/12:00:00/空白|拒絕，原稿保留，不默改時間|
|W11|FR03|A+B|rest空白/-1/1.5/1e2/+1/1,000|均拒絕，不當0|
|W12|FR03|A|10:00–11:00 rest60/61|60合法net0；61 BREAK_EXCEEDS_SPAN|
|W13|FR04|A+B|09–12和11–13|ROW_OVERLAP，兩列識別，不給部分總計|
|W14|FR04|A+B|09–12和12–13|相接合法240分鐘|
|W15|FR04|A+B|10/01 22–02次日與10/02 01–03|跨日重疊拒絕|
|W16|FR04|A|09–17 rest420與12–13|即使扣休息仍重疊拒絕|
|W17|FR04|A|09–17包住10–11和12–13|檢查maxEnd，拒絕，不只檢查相鄰短段|
|W18|FR05|A|10/02 1小時；10/01 2小時|days排序10/01 120、10/02 60；rows原順序；total180|
|W19|FR05|A+B|3個互不重疊1分鐘段|total3分鐘/0.05，不能0.06|
|W20|FR05|A|1/2/59/60/90分鐘格式|0.02/0.03/0.98/1.00/1.50；時分正確|
|W21|FR01,10|A+B|1列、62列、63列；連續62天各24h|前兩可；63拒絕；62天89280分鐘/1488.00h|
|W22|FR02,03|A|date32/33、time16/17、break16/17原碼元且外側ASCII空白|邊界內trim判格式，+1先LENGTH，不truncate|
|W23|FR01,06|B|增刪列、範例、清除|最少1最多62；範例需再計算；clear一空時段|
|W24|FR06|A+B|成功後改一欄/次日/新增/刪除|結果立刻空、copy停用，重算才更新|
|W25|FR07|A+B|copy成功/拒絕/clear後晚到promise|完整LF報告，失敗可手選；晚回不能復活舊報告|
|W26|FR07|A|同revision两次copy先後逆序resolve/reject|只有最新request可改status（或busy拒絕第二次）|
|W27|FR06,08|B|輸入/計算後離頁返回BFCache|舊時段/結果已空，日期可初始化今日|
|W28|FR08|B|Network/Storage载入、編輯、算、copy、hidden|只第一方static，無內容傳輸/storage；含/cdn-cgi/rum；觀察不足NOT_RUN|
|W29|FR09|B|兩語鍵盤、320px、真200%zoom|同功能可達，focus/error正確，無整頁水平overflow|
|W30|FR02,08|A+B|欄位<img onerror...>、unknown schema key、null/array|固定拒絕不執行、不rawstack、不異常上傳|
|W31|FR10|A|dev /../、encoded traversal、hidden/junction，build hardlink/stale|拒絕並保留outside sentinel，dist僅allowlist|
|W32|FR09|A+B|preview/meta及後續production两語HTTP|previewnoindex；production canonical/alternates/xdefault/robots/sitemap/JSONLD/404/headers正確，各自記錄|

M1必要 gate：核心日期/整數/重疊/輸出/失效/邊界自測、真工具鏈npm test/check/build、至少一個真瀏覽器雙語主要流程W01/W03/W13/W24與可操作錯誤。瀏覽器真正觀察與Node UI harness分開；不能以Node假DOM代替B。完整Network/Storage、原生clipboard權限、讀屏、手機真機和其他瀏覽器/zoom依工具能力可逐項NOT_RUN，但必要核心或工具鏈FAIL不能跳過。正式SEO/hosting是M2/M3，不用預覽noindex判bug。

不要求實體打卡/工資法規驗收，因產品明確不處理。每次固定code hash與實際命令exit/瀏覽器版本/輸入觀察，沒有搜尋收錄保證；外部確認才完成版本。
