# 工程與Windows安全

Node24+、ESM、原生HTML/CSS/browser modules與node:test。正式站只有靜態HTML/CSS/JS/必要資產，Node只是开发/建置；不自動加入framework或runtime套件。測試只用合成假資料，核心測試離線，不能依賴第三方服務。

package.json private=true、type=module、engines.node>=24；M1/T00建立dev/test/check/build，M2建立build:production/check:production。serve僅public、127.0.0.1:4198，GET/HEAD、嚴格路徑containment、拒絕hidden/symlink/穿越；沒有form post endpoint。相依模組應相對引用，en页可用有界../資產，但任何resolver必須驗正規化後在公開根內。

check真實驗ESM語法、必要檔案、locale parity、引用目標/本機URL、已核准資產集合與危險DOM/network API；掃描只是輔助證據。build先verify allowlist再在本工具dist複製，禁止public以外檔案混入。破壞性file操作前解析絕對target，拒絕junction/symlink與scope外路徑，一個shell end-to-end；不清理使用者或別人專案。

已實證的工具鏈缺陷須防回歸：檢查所有祖先而非只看末端symlink；build遇hardlink或未知stale資產要安全拒絕，外部sentinel不能被改寫。HTML active attributes引用檢查須涵蓋quote/case/註解差异，不把註解meta當可見robots，不把首頁navigation白名單套到script src。這些是開發/發布邊界，不是產品頁面文案。

不要在孵化器根做checkout/reset/clean/stash/commit/push；發布只使用指定獨立reviewed copy。保留其他diff和進程，不拿開發port占用作批殺理由。只終止自己擁有且已核實PID/command/startTime的disposable程序。

Windows的User/Machine環境、PATH、TEMP/TMP、registry、services、pagefile、BCD不可為建置方便修改。禁止setx、Environment User/Machine setter、改系統PATH。只用完整exe路徑或子程序環境。臨時cache/CLI home/build workspace永不進持久PATH。

長建置/測試/安裝前後如本Windows帳號提供 .codex/check-persistent-environment.ps1，執行並保存HKCU/HKLM PATH型別、長度、SHA、ephemeral-entry count及full Environment-key fingerprint。前後必須相同；自己造成的精確漂移只恢復captured原值/型別並報告，未知來源先停，不猜測修復。

若未來批准使用dotnet且temporary DOTNET_CLI_HOME，在第一次dotnet之前子程序设DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=0。PS7啟動PS5.1時使用完整Windows PowerShell路徑，去除/設定child-only PSModulePath，不能讓不相容模組覆蓋內建；不改ExecutionPolicy。

測試與受影響行為一起提交，必要gate在最終實作跑一次，相關變更/失敗再跑。不能改門檻/預期掩蓋失敗。當前gate通過後繼續下一個，非必要風格建議留backlog。

