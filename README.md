# AI Product Organization

這是一個可跨產品、跨 AI provider 重複使用的 AI Product Organization。

核心角色很簡單：

```text
HH / Founder / CEO
        ↓
PDM / Senior Product Director
        ↓
Research / Design / QA / Engineering
```

HH 保有 Founder 級決策權；PDM 負責產品組合層級的判斷、工作選擇、方法論運用、專家委派與持續推進；Research / Design / QA / Engineering 是可跨產品重用的 functional agents。

這個 repo 本身是 **PDM Core**。產品自己的知識、工作狀態與產品文件應該留在各自的 product repository，而不是全部複製到這裡。

## 哪份文件是給誰看的

每個事實只有一個擁有者。其他檔案連結過去，不複述。

**人（HH）讀：**

| 檔案 | 回答什麼 |
|---|---|
| `README.md`（這份） | 這是什麼、解決什麼問題、目前狀態 |
| [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) | 怎麼啟動、在哪工作、怎麼確認進了正確模式。**啟動指令只在這裡** |

**Agent 讀：**

| 檔案 | 回答什麼 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 只有一件事：去讀 `AGENTS.md`（Claude Code 啟動時自動載入） |
| [`AGENTS.md`](AGENTS.md) | 跨 provider 的工作契約：自主權邊界、方法論路由、並行隔離、review surface |
| [`governance/`](governance/) | 逐項規則，依任務需要才讀，不預先全部載入 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 架構記錄與範圍邊界（人也可讀，但它是 agent 判斷邊界的依據） |

**目錄層級參考**（在該目錄工作時才需要）：[`methodology/README.md`](methodology/README.md)、[`products/`](products/)、[`organizations/README.md`](organizations/README.md)、各 `provenance/`。

`AGENTS.md` 與 `governance/` 放的是**規則**，不是操作教學。「事後的 `cd` 不會改變 startup context」是 agent 需要知道的約束；「要打哪幾行指令」是 HH 要做的動作，屬於 `GETTING_STARTED.md`。

## 這個系統解決什麼問題？

最重要的不是「做一個很大的 prompt」，而是把 PDM 的規則與產品工作的 durable state 放在 Git 裡。

因此今天由 Claude Code 工作、明天改由 Codex 接手，核心連續性不應依賴某一個模型的聊天記憶：

```text
PDM Core
  ├── governance / role / autonomy
  ├── methodology
  ├── portfolio routing
  └── runtime

Product repositories
  ├── Product Context
  ├── Work State
  ├── Active Brief
  ├── decision records
  └── product artifacts
```

這也是本 repo 同時保留 provider-neutral `AGENTS.md` 與 provider-specific bootstrap adapter（例如 Claude Code 的 `CLAUDE.md`）的原因。

## 目前架構

```text
agents/          可重用的 functional agents
  pdm/           Senior Product Director
  research/      Research agent
  design/        Design agent
  qa/            QA agent
  engineering/   Engineering / Coding agent
  evolution/     PDM Evolution Agent

runtime/         PDM Core 的 executable runtime
  registry       methodology capability metadata / resolution
  context        Product Context bounded retrieval / writes
  workState      Work State / Active Brief
  decisionRecord Founder checkpoint / decision persistence
  productRegistry product repository + portfolio metadata
  portfolio      多產品工作選擇與狀態推導
  organizationContext Organization Context bounded retrieval
  productSync    deliberate product/org git sync / publish
  orchestrator   工作推理與 capability routing

methodology/     HH 擁有的方法論 baseline
vendor/          外部方法論的一次性 seed / provenance，不是 runtime dependency
products/        Product Registry 與 development fixtures，不保存真實產品內容
bin/             真正接觸 process / git / network 的 runtime adapters

governance/      PDM identity、authority、autonomy、delegation、evidence、協作規則
docs/            架構記錄、提案、使用文件
tests/           Node test suite 與 architectural invariants
```

## 多產品運作

PDM 是 portfolio-level worker，不是一次只管理一個產品。

目前 portfolio 已包含四個 real products：

- `colon-biopsy-ai-app`
- `prostate-biopsy`
- `ocr-slide-label-reader`
- `slide-quality-control`

產品可以處於 `READY`、`WAITING_FOR_FOUNDER`、`BLOCKED`、`IDLE` 或 `UNINITIALIZED`；這些是由 Work State 與 decision 狀態推導出來的，不另外儲存一份 portfolio 狀態。

某一個產品等待 HH 時，只會卡住那個產品，不應讓整個 PDM worker 停下來。

## HH 怎麼開始用？

啟動步驟、位置驗證、以及各 provider 的差異，全部在 [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md)，這裡不重複。

唯一要先記住的一點：**從 PDM Core repo root 啟動 agent**，而不是在別的目錄啟動後再靠單次 Bash `cd` 補救 —— 事後的 `cd` 不會改變 agent process 的 startup context。

啟動後，HH 可以直接用自然語言交辦工作，不需要每次重新貼完整背景。例如：

```text
繼續處理目前 portfolio 中下一個最高價值的工作。
```

PDM 應自己讀取必要的 portfolio / product state，選擇 work unit，完成它有權完成的工作，遇到真正需要 Founder 決策的事項才建立 checkpoint。

## HH 與 PDM 怎麼協作？

PDM 的目標是消耗 **Founder decision bandwidth**，而不是 Founder execution bandwidth。

一般情況下：

```text
HH 給目標
   ↓
PDM 分析 / 查證 / 執行
   ↓
可自行決定的事情 → 直接做
   ↓
真正需要 Founder 決策
   ↓
Founder Decision Brief
   ↓
terminal / tmux 內直接呈現重點 + remotely reachable link
   ↓
HH 決定
   ↓
PDM 保存 decision record
   ↓
回到 portfolio loop
```

所以 PDM 不應每做一小步就問：「要不要繼續？」

當某產品進入 `WAITING_FOR_FOUNDER`，PDM 也不應停止整個 portfolio，而是繼續處理其他 runnable products。

## Git 的角色

Git 是 durable state 的主要載體，但不是所有 Git 操作都等於 Founder 決策。

PDM 可以建立 session branch、commit、push、建立或更新 PR；合併到 product default branch、破壞 durable history、建立/刪除 repository、改權限等動作仍然需要 Founder。

產品 repository 則是產品自己的 source of truth。PDM Core 裡的 `products/registry.json` 主要是一個 pointer/index，用來知道產品 repo 在哪裡與如何解析。

## 方法論與產品 Context 的邊界

```text
PDM Core / Methodology
    = 可跨產品重用的做事方法、治理、能力

Organization Context
    = 同一組織下跨產品成立的流程 / 角色 / 系統事實

Product Context
    = 某個產品的 strategy / users / evidence / decisions / experiments / roadmap

Work State
    = PDM 目前做到哪裡、下一步、blockers、open questions

Active Brief
    = Work State + bounded context 的小型 session bootstrap
```

這些層級不能互相取代，也不要因為某個資訊看起來有用就把它複製到另一層。

## 目前狀態

本 repo 已有 working runtime、portfolio routing、Product Context / Work State boundaries、Founder checkpoint persistence、git-remote sync/publish，以及 Organization Context 的 bounded resolution。

測試使用 plain Node.js `node:test`，repo 不依賴額外 npm 套件。執行：

```bash
npm test
```

架構細節請看 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。AI agent 的工作規則請看 [`AGENTS.md`](AGENTS.md)。Claude Code 的 startup adapter 是 [`CLAUDE.md`](CLAUDE.md)。
