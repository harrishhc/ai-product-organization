# Proposal — Organization Context Layer

**Status:** PROPOSAL — 未實作,未核可。`runtime/` 未更動一行。
**Authority:** Material PDM evolution → Propose / Required approval(`PDM_CONSTITUTION.md` Authority Matrix)
**Raised:** 2026-09-14
**Requested by:** HH

---

## 0. 先講一件我重新檢查後修正的事

我原本打算用「本次 live pilot 的 wedge 失敗」當作這個提案的失敗案例佐證。**重新檢查後,那個論證不成立,我把它撤掉。**

那次失敗(`dec_1789321602255_h32ovb`)的真正成因是 **Product Context 缺漏** —— IFU 與 PRD 的範圍邊界從來沒有被讀進 `context.json`。它已經在同一個 session 內用現有架構修好了,不需要任何新層級。

用它來論證 Organization Context,會是把一個產品層的失敗拿去正當化一個組織層的新架構 —— 正是 `GOVERNANCE_PRINCIPLES.md` 要防的那種論證。

所以下面的提案,誠實地建立在**結構論證**上,而不是已觀察到的失敗上。這一點直接影響我的建議(見 §5)。

---

## 1. 問題:三種 scope,架構只有兩種

`docs/ARCHITECTURE.md` §2/§6 的核心切分是二分的:

| Scope | 現有的家 |
|---|---|
| 跨產品 reusable | PDM Core / methodology / functional agents |
| Product-specific | Product Context / Work State / Active Brief |

HH 交接的內容裡,有一類事實**兩邊都不屬於**:

> aetherAI 進 sprint 需要 ticket 完整(通常含 design 的 Figma 連結);流程為 sprint refinement → sprint plan meeting(RD 說明預計做法);PM 定義 WHAT、RD 自組織 HOW;產出文件應放 Drive 的 PDM 產品資料夾;ClickUp 為 ticket 的 live source of truth;需在 biweekly CEO meeting 報告手上產品。

這些**跨越 HH 的多個產品,但不普世於 PDM** —— HH 明確表示「我有可能會有不同產品但走不屬於此公司之開發流程」。

兩個現有的家都塞不進去:

- **塞進 Product Context** → 它不是關於該產品的事實。而且第二個 aetherAI 產品註冊的當下就開始複製與漂移。
- **塞進 PDM Core** → 變成普世規則。HH 一有走別套流程的產品就壞掉,而他明講這會發生。

## 2. 提議的形狀

一個 **Organization Context**,解析方式與 Product Context **完全對稱** —— 不是新機制,是既有 pattern 的鏡像。

### 2.1 Registry 差異

`products/registry.json` 新增一個 top-level `organizations` 映射,產品 entry 新增**選填**的 `organization` 欄位:

```json
{
  "organizations": {
    "aetherai": {
      "repository": { "type": "local_path", "location": "./organizations/aetherai" },
      "context_entry": "org-context.json"
    }
  },
  "products": {
    "colon-biopsy-ai-app": {
      "repository": { "...": "unchanged" },
      "organization": "aetherai",
      "status": "active",
      "priority": 1
    }
  }
}
```

`organization` 未宣告 = 該產品不套用任何組織流程。這正是「走非公司流程的產品」的支援方式 —— 不需要 opt-out 旗標,預設就是不套用。

### 2.2 解析流程

```
PDM → Product Registry → 選定產品
                          ├── resolve product repository → bounded Product Context
                          └── 若宣告 organization → resolve org repository → bounded Organization Context
```

有效工作 context: `PDM Core + Organization Context(若宣告)+ Product Context`

### 2.3 Runtime

新增 `runtime/organizationContext.js`,鏡像 `context.js`:同樣的 path-traversal 防護、同樣的 bounded section 讀取、同樣的「絕不自動寫入」規則。

**關鍵約束:`portfolio.js` 的 refresh 絕不得載入它。** Portfolio refresh 的 cheapness contract(一個小 work-state 檔 + 一個 bounded section)不能因此變貴。

### 2.4 Bounded sections(建議)

`delivery_process` · `roles` · `artifact_conventions` · `reporting_obligations` · `systems_of_record`

## 3. Boundary test — 防止它變成雜物抽屜

這是這個提案能不能站得住的關鍵。用 colon 實際套一遍:

| 事實 | 歸屬 | 理由 |
|---|---|---|
| sprint refinement → plan meeting 流程 | **Org** | 跨 aetherAI 所有產品 |
| ticket 需含 Figma 連結才進 sprint | **Org** | 同上 |
| PM 定義 WHAT、RD 自組織 HOW | **Org** | 同上 |
| ClickUp 為 live source of truth | **Org** | 同上 |
| Drive PDM 資料夾為產出目的地 | **Org** | 同上 |
| biweekly CEO 報告義務 | **Org** | 同上 |
| Inform-level CADx 定位、不產生敘述內容 | **Product** | 只關於 colon 的法規宣稱 |
| 三模型並行推論、11 判型 | **Product** | 只關於 colon |
| N=300 驗證設計、國泰雙盲讀片 | **Product** | 只關於 colon |
| TFDA/CDE 分類未決 | **Product** | 只關於 colon 的未決事項 |
| 「送件前要過 RA」這件事本身 | **Org** | 跨產品的流程約束 |

**判準一句話:** 換掉產品之後這句話還成立嗎?成立 → Org;不成立 → Product。

## 4. 與「Deliberately Not Built」的關係

`GOVERNANCE_PRINCIPLES.md` 明確拒絕過 **"A second memory/state system alongside Work State + Active Brief"**。

這個提案**不是**那一項。被拒絕的是「同一個東西的第二份持久化」—— 再開一個地方存 PDM 對某產品的操作狀態。Organization Context 存的是**不同 scope 的不同事實**,它不重複 Work State、不重複 Product Context,也不能主張任何產品事實。

但我承認兩者相鄰,而且相鄰到值得你直接壓力測試,而不是由我自己判定通過。

## 5. PDM 建議(conditional)

**我的建議取決於一個我不知道的事實:你接下來要註冊幾個 aetherAI 產品?**

| 情境 | 建議 |
|---|---|
| 這個週期內會註冊 **≥2 個** aetherAI 產品 | **現在就建這一層。** 重複與漂移會在第二個產品註冊當下實際發生,屆時再搬成本更高。 |
| colon 在可見未來仍是**唯一**註冊產品 | **先不要建。** 改用下面的 interim,等真實失敗出現再升級。 |

**Interim(不需要任何架構變更):** 把 aetherAI 流程寫成 colon repo 裡一份獨立文件(例如 `product-context/org-conventions.md`),並在 `context.json` 明確標註它是組織層事實、暫時寄居於此。接受重複,但把重複**標記出來** —— 這樣第二個產品註冊時,漂移是可見的,而不是靜默的。

我傾向 interim,理由是這個 repo 自己的紀律:`GOVERNANCE_PRINCIPLES.md` 要求新層級需要「一個這條規則本來會擋下的真實失敗案例」。**目前還沒有。** 結構論證很清楚,但結構論證正是該文件說不夠的那種論證。

## 6. 其他選項(已考慮並排除)

| 選項 | 排除理由 |
|---|---|
| 放進 methodology 層 | 類別錯誤。Methodology 是可重用的**產品方法**(Double Diamond 之類),不是特定公司的流程。 |
| 放進 PDM Core governance | 變成普世規則,對非 aetherAI 產品即錯誤。 |
| 放進 Claude Code / 模型端 memory | **違反 `COLLABORATION_PROTOCOL.md`** —— worker 不得假設 provider 對話記憶是 durable。放那裡等於換到 Codex 就消失。 |
| 每個產品各存一份 | 即 §5 的 interim。可接受作為過渡,不可接受作為終局。 |

## 7. 風險

- **雜物抽屜化。** 緩解:§3 的 boundary test 必須與這層一起落地,不能事後補。
- **Runtime 表面積增加。** 多一條解析路徑就多一條要維護、要測試的路徑。
- **過早抽象。** 若最終只有一個 aetherAI 產品,這層就是為了一個實例而建的抽象 —— 正是本 repo 反覆拒絕的那種成本。

## 8. 需要你回答

1. **你接下來要註冊幾個 aetherAI 產品?**(決定 §5 走哪一條)
2. 若走 interim:要我現在就把 aetherAI 流程寫進 colon repo 的 `org-conventions.md` 嗎?
3. §4 的「這不是被拒絕的第二記憶體系統」論證,你買不買單?
