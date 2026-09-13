# AI Product Organization — Agent Instructions

本檔案給任何支援 [AGENTS.md 慣例](https://agents.md)的 AI coding agent 閱讀(Claude Code、Codex CLI、Cursor 等)。這個約定的重點是**跨供應商可攜性**:今天用 Claude 做到一半,明天換 Codex 接手,狀態與規則都在這個 repo 裡,不在任何一個模型的對話記憶裡。

## 這個 repository 是什麼

這是 **PDM Core**——一個可跨產品重用的 AI Product Organization 的治理與 runtime。它不擁有任何產品自己的知識庫;產品各自有自己的 repository(見 `products/registry.json`)。

角色:
- **HH / Founder / CEO** — 最終決策者。
- **PDM** — reusable Senior Product Director,這個 repo 訓練/約束的對象。
- **Research / Design / QA / Engineering** — 可重用的 functional agents(`agents/`)。

## 開始工作前必讀,依序

1. [`governance/PDM_CONSTITUTION.md`](governance/PDM_CONSTITUTION.md) — PDM 是誰、對什麼負責、何時必須挑戰 Founder、Five Statements、Authority Matrix。
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 完整架構記錄,五層(PDM Core / Active Brief / Product Context / Work State / Methodology)+ Portfolio(§6.2)。
3. [`governance/ROLE_BOUNDARIES.md`](governance/ROLE_BOUNDARIES.md)、[`governance/DELEGATION_LOGIC.md`](governance/DELEGATION_LOGIC.md)、[`governance/EVIDENCE_DISCIPLINE.md`](governance/EVIDENCE_DISCIPLINE.md)、[`governance/GOVERNANCE_PRINCIPLES.md`](governance/GOVERNANCE_PRINCIPLES.md)。
4. [`governance/WORK_STATE_BOUNDARY.md`](governance/WORK_STATE_BOUNDARY.md) — Product Context / Work State / Active Brief 的邊界,session 協定,Decision persistence protocol(何時必須 publish)。

不要因為文件講了某件事就假設 runtime 已經強制執行——`runtime/` 底下的程式碼才是實際行為,文件是規則,兩者要對照。

## Runtime 在哪裡、能做什麼

- `runtime/*.js` — 純 Node.js,無外部 npm 依賴。`npm test` 跑 132+ 個測試,涵蓋行為與架構不變量(architectural invariants)。任何 agent 都能執行,不限 Claude。
- `runtime/productRegistry.js` + `products/registry.json` — 產品清單、每個產品的 repository 位置(`local_path` 或 `git_remote`)、portfolio 政策(`priority`、`status`)。
- `runtime/context.js` / `workState.js` — 讀寫某產品的 bounded Product Context / Work State,一律透過 Product Registry 解析路徑,絕不掃描檔案系統。
- `runtime/decisionRecord.js` — 把 `decision.js` 的決策(含**尚未拍板、正在等 HH 的 pending checkpoint**)寫進該產品自己的 `context.json`。
- `runtime/portfolio.js` — 多產品時,推導每個產品的可執行狀態(`READY` / `WAITING_FOR_FOUNDER` / `BLOCKED` / `IDLE` / `UNINITIALIZED`)並選出下一個該做的工作。狀態永遠是推導出來的,不是存起來的。
- `runtime/instrumentation.js` — session 的 waste-observability 計數器,以及 `shouldContinue()`(Runtime Governor,真實用量訊號由呼叫方注入)。
- `bin/pdm-git.mjs` — **唯一**真正執行 git 的地方(`sync` / `publish` / `status`)。`runtime/` 本身刻意不含任何 process/network 程式碼;要讓 `git_remote` 產品真的同步或推送,執行這支 CLI。

## 核心紀律(不要違反)

- **Bounded context 優先**:讀一個產品的狀態,先讀 `active-brief.md`,不夠才讀 `context.json`(依 section),再不夠才進 `knowledge/`。不要一次載入整個 methodology library 或整個產品歷史。
- **Work State ≠ Product Context**:PDM 做到哪裡(Work State)跟產品是什麼(Product Context)分開存,前者不能單獨主張任何 decision。
- **Pending checkpoint 一定要 persist**:PDM 提出建議、正在等 HH 回覆時,立刻 `upsertDecisionRecord()` 並 publish——不要等 HH 回覆才寫,否則對話意外中斷會讓下一個 session(不管是哪個模型)忘記這個產品在等人。
- **Priority 是唯一的 portfolio 級別事實**,只存在 `products/registry.json`;`READY`/`BLOCKED` 這類狀態永遠是推導,不要存進任何檔案。
- **一個產品卡住,不擋住整個 portfolio**:`WAITING_FOR_FOUNDER` 只影響那一個產品,PDM 應該換去做其他 `READY` 的產品。
- **git 操作只能透過 `bin/pdm-git.mjs`**,不要繞過去手動下 git 指令改產品的 clone。

## 不要自己發明的東西

見 [`governance/GOVERNANCE_PRINCIPLES.md`](governance/GOVERNANCE_PRINCIPLES.md) 的「Deliberately Not Built」——加權評分框架、第二套 memory system、node/workflow graph、per-decision 的獨立 branch、portfolio 裡的 critical-path 排序、repo 內建 scheduler,這些都已經被明確判斷過並拒絕,理由寫在那裡。要重新提案,需要一個這條規則本來會擋下的真實失敗案例,不是「感覺可以做得更完整」。
