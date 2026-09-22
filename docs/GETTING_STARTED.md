# AI Product Organization 使用教學

這份文件是給 **HH / Founder** 看的。它解決的不是 PDM 怎麼做產品，而是「我到底要怎麼啟動這個系統，怎麼讓 Claude Code / Codex 接手，以及我要在哪裡跟 PDM 工作」。

## 先理解一件事：這個 repo 不是聊天機器人

`ai-product-organization` 是 PDM Core。它把 PDM 的規則、方法論、產品索引，以及產品工作狀態放在 Git 可保存的地方。

模型本身的對話記憶不是唯一真實來源。換模型、重開 session、甚至換機器，都應該能靠 repository 裡的 durable state 繼續工作。

目前可以把系統想成四個東西：

```text
你（HH / Founder）
        ↓
PDM Worker
        ↓
PDM Core + Product Registry
        ↓
選定的產品 repository
```

`PDM Core` 決定 PDM 是誰、怎麼工作；產品 repository 保存某一個產品自己的 Product Context / Work State / artifacts。

## 第一次使用：先確認你真正啟動的是哪個目錄

這一步非常重要。

Claude Code 和 Codex 都有「目前工作目錄（current working directory / cwd）」的概念。你啟動 agent 時所在的目錄，決定它一開始看到哪個專案、哪些 instruction files 可以自動進入 context。

**不要把「在 Bash 裡 `cd` 到 repo」當成等同於「agent 是從這個 repo 啟動」。**

例如你現在的環境是：

```text
公司電腦 PowerShell
    ↓
連到公司 VM
    ↓
tmux
    ↓
Claude Code Remote Control
    ↓
目前 session cwd = ~/remote-hub
```

假設你在某一次 Bash tool call 裡執行：

```bash
cd ~/workspace/ai-product-organization
```

那個 shell 的 `cd` 不代表 Claude Code 這個長期 session 的 cwd 已經永久改成該目錄。如果下一次 tool call 又回到 `~/remote-hub`，這是 host/tool 的工作方式，不是 PDM repository 把狀態弄丟了。

更重要的是：**Claude Code 自動載入的是 `CLAUDE.md`，不是單靠 `AGENTS.md`。** 本 repo 因此提供了一個很小的 root `CLAUDE.md` adapter；它只負責把 Claude Code 帶進 `AGENTS.md`，真正的 PDM 規則仍以 `AGENTS.md` 為準。

Codex 則原生使用 `AGENTS.md` 作為 repository instructions。

## 推薦的啟動方式

### 方法 A：從 repo root 啟動 agent（推薦）

在 VM 的 shell / tmux pane 裡，先：

```bash
cd ~/workspace/ai-product-organization
```

確認位置：

```bash
pwd
git rev-parse --show-toplevel
```

兩個結果應該都指向：

```text
~/workspace/ai-product-organization
```

接著再啟動 agent：

```bash
claude
```

這樣 Claude Code session 本身就是從 PDM Core repo 啟動，root `CLAUDE.md` 才會在 startup 時自動進入 context。

Codex CLI 同理，從 repo root 啟動：

```bash
cd ~/workspace/ai-product-organization
codex
```

### 方法 B：你已經在一個固定 cwd 的 Remote Control session 裡

假設你現在只能從 `~/remote-hub` 開始，而沒有方便的方法重新啟動 session，那麼不要假設單次 Bash `cd` 能改變整個 agent 的 startup context。

你仍然可以用絕對路徑完成工作，例如：

```bash
ls ~/workspace/ai-product-organization
```

但這種方式**不會自動讓 Claude Code 把 repo 的 `CLAUDE.md` 當成 startup instruction**。因此它不適合作為正式的 PDM Worker 啟動方式。

正式使用時，請讓 host 在正確的 repo root 啟動 Claude Code；Remote Control 只是你從瀏覽器連進去的控制介面，不應該取代 host 的 working-directory 設定。

## 第一次進入 PDM Worker 模式

從 repo root 啟動新的 Claude Code / Codex session 後，先送一次這個 prompt：

```text
You are the HH PDM Worker.

Use the repository's AGENTS.md and governance as the authoritative operating contract.
Start from the current portfolio state, select the next runnable work, and operate as the PDM responsible for the active portfolio.
Do not stop merely because one product is waiting for Founder input.
For any artifact HH needs to review, surface enough content inline and provide a remotely reachable link.
Follow the autonomy and collaboration boundaries in the repository.
```

這個 prompt 是「啟動角色」，不是把整套方法論重新貼給模型。真正的規則應該留在 repo 裡。

之後日常工作就可以直接用自然語言，例如：

```text
繼續處理目前 portfolio 中下一個最高價值的工作。
```

或：

```text
評估 colon-biopsy-ai-app 的 PRD 目前是否值得進入 git-based 維護流程，先完成分析並告訴我需要我決定的事項。
```

PDM 應自己讀取必要的狀態、方法論與產品資料，不要求 HH 每次重新描述背景。

## 每次 session 開始時，實際應該發生什麼

正常情況下，你不需要自己一個一個檔案打開。PDM 應該遵守 repository 的 bootstrap / bounded-context 規則。

完整的延續鏈定義在 [`../governance/COLLABORATION_PROTOCOL.md`](../governance/COLLABORATION_PROTOCOL.md)「Cross-provider handoff」——那是唯一版本，這裡不重複那張圖。你只需要記住重點：**只讀需要的東西**。不應每次把所有產品、所有歷史、整套 methodology 都塞進 context；一個正常啟動的 session 應該只走到「選定產品 → 讀它的 Active Brief/Work State → 需要時才展開 bounded context」就開始做事，不會把整個 repository 攤開。

## 你怎麼知道它真的進入了正確模式？

新的 session 開始後，可以直接問：

```text
What is your current working directory, what repository are you operating in, and what instruction files did you load?
```

你要看到的核心結果是：

```text
working directory: ~/workspace/ai-product-organization
repository: harrishhc/ai-product-organization
```

並且它知道 root `CLAUDE.md` / `AGENTS.md` 的存在與作用。

也可以要求它執行：

```bash
pwd
git rev-parse --show-toplevel
git status --short
```

這三個結果比模型口頭說「我已經進入 PDM 模式」可靠。

## PDM 與 HH 的實際協作方式

PDM 不是每做一步就問你一次「要不要繼續」。

完整的流程規則（Founder Decision Brief 該包含什麼、怎麼呈現、HH 的回覆怎麼被分類）定義在
[`../governance/COLLABORATION_PROTOCOL.md`](../governance/COLLABORATION_PROTOCOL.md)
的「Founder checkpoints」與「HH's response」——那是唯一版本，這裡不重複那張流程圖或分類規則。

這裡只留你會實際看到的樣子。HH 的主要成本應該是「決策」，不是「幫 PDM 操作 terminal」。

例如 PDM 說：

```text
Recommendation: B

Evidence:
- ...
- ...

Option A:
- ...

Option B:
- ...

Founder decision:
Choose A / B, or tell me what assumption you want changed.
```

你可以直接回：

```text
照你的建議做。
```

或：

```text
我不同意，因為這個前提不成立。重新驗證 X。
```

或：

```text
先不要決定，補查 Y。
```

這三種（決定 / 挑戰 / 要求先別決定）都應該能直接進入相應流程，不需要固定 command——分類規則見上面連結的 governance 文件。

## Git 與產品 repo 怎麼理解

PDM Core 與產品 repository 是兩個不同層級：

```text
harrishhc/ai-product-organization
    = PDM Core / governance / methodology / portfolio routing

harrishhc/colon-biopsy-ai-app
    = colon-biopsy-ai-app 的 Product Context / Work State / product artifacts

harrishhc/prostate-biopsy
    = prostate-biopsy 的 Product Context / Work State / product artifacts

...
```

PDM Core 裡的 `products/registry.json` 是索引，不是把所有產品內容複製一份放進來。

因此你在 HH 對 PDM 說「評估 colon biopsy PRD 是否改成 git 維護」時，PDM 應該把這視為一個產品工作流程問題，調查目前 repository 狀態、版本管理需求、文件維護方式與成本，再提出建議；不是一收到問題就直接把結論寫成規則。

## 常見錯誤

### 錯誤 1：先進 `~/remote-hub`，之後每次 Bash 都 `cd`

這可以讓某一個 command 找到檔案，但不能保證 Claude Code startup 時已經載入 PDM Core 的 instructions。

### 錯誤 2：以為 `AGENTS.md` 會被所有 provider 自動載入

不會。不同 provider 有自己的 instruction discovery 機制。這也是本 repo 同時保留 provider-neutral `AGENTS.md` 和很小的 provider adapter 的原因。

### 錯誤 3：把大量產品歷史直接貼進聊天

不要這樣做。把 durable information 寫回正確的 Product Context / Work State / decision record，聊天只負責當下互動。

### 錯誤 4：要求 PDM 每一步都先問 HH

這會把 Founder 的時間變成 execution bandwidth。PDM 應先自己完成它有權完成的事情，只有真的需要 HH 決策時才停在那個產品的 checkpoint。

## 建議的日常操作

你每天真正需要記住的通常只有這一個啟動習慣：

```bash
cd ~/workspace/ai-product-organization
claude
```

然後直接用自然語言跟 PDM 工作。

離開前不需要把「今天做到哪裡」重新整理成一篇聊天筆記。正常的 PDM worker 應該把需要持續的狀態保存到 repository，下一個 session 再從 durable state 恢復。

## 相關文件

`AGENTS.md`：AI agent 的主要 repository-level operating contract。

`CLAUDE.md`：Claude Code 的極薄 bootstrap adapter，不放第二套 PDM 規則。

`governance/COLLABORATION_PROTOCOL.md`：PDM Worker 與 HH 的協作方式。

`governance/AUTONOMY_BOUNDARY.md`：哪些事情 PDM 可以直接做、哪些事情必須等 HH。

`docs/ARCHITECTURE.md`：完整架構記錄。
