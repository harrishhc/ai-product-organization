# Proposal — Fix capability routing: the metadata is already there, the runtime ignores it

**Status:** PROPOSAL — 部分實作（2026-09-30 核對）。
- **B 已實作：** `selectCapability`/`filterCandidates` 分出 `uncertaintyType`（封閉 token，硬過濾只比對它），Work State 新增選填 `uncertainty_type`，`pdm-run next` 據此印出 delegation 提示。
- **A 部分：** cue 已被讀取（`selection_cues` 進描述性比對、`anti_cues` 隨候選輸出）；`cost_profile` 仍未使用，`selectSmallestSufficient` 仍用寫死的 `TIER_RANK`。
- **C 未變：** 仍為「用過才標」，registry 目前沒有任何 capability 宣告 `uncertainty_types`，所以硬過濾在實務上尚不作用；且 `scripts/build-methodology-registry.mjs` 不會輸出該欄位，要在 skill 層宣告需先擴充 build script。
- **D 未變：** `orchestrator.js` 的錯誤訊息與 `ARCHITECTURE.md` §17 的自述尚未改寫。

**Authority:** Material PDM evolution → Propose / Required approval
**Raised:** 2026-09-15

---

## 0. 更正我先前的說法

我先前告訴 HH:「`uncertainty_types` 在 244 個 capabilities 裡全空,這個要補得動 244 筆 metadata。」

**那個結論的方向對,但把問題診斷錯了,而且開錯藥。** 實際查證後:

| 查證 | 結果 |
|---|---|
| registry 裡有幾個 capability 宣告 `uncertainty_types`? | **0**(連 key 都不存在) |
| source frontmatter 有嗎? | **沒有**。`grep -r uncertainty` 命中的 8 個檔案全是 skill 內文散文,不是 frontmatter |
| 那 registry 裡有沒有其他路由訊號? | **有,而且很完整** —— `selection_cues`、`anti_cues`、`cost_profile` |
| runtime 有讀它們嗎? | **完全沒有**。`grep -n "selection_cues\|anti_cues\|cost_profile" runtime/*.js` 零命中 |

所以正確的問題不是「要補 244 筆 metadata」,而是:**能用的路由 metadata 早就寫好了,程式碼從來沒讀過。**

## 1. 現況:一個永遠不會觸發的分支

`runtime/registry.js#filterCandidates`:

```js
const uncertaintyTypes = cap.uncertainty_types ?? null;
const uncertaintyMatch = uncertaintyTypes && dominantUncertainty
  ? (uncertaintyTypes.includes(dominantUncertainty) ? 'matched' : 'mismatch')
  : 'unknown';
if (uncertaintyMatch === 'mismatch') continue;
```

`uncertainty_types` 永遠是 `undefined` → `uncertaintyMatch` 永遠是 `'unknown'` → 永遠不過濾、也永遠不升級 fit。**`dominantUncertainty` 被強制要求、被傳進來、然後被丟掉。**

而 `runtime/orchestrator.js#selectCapability` 的錯誤訊息宣稱:

> routing must not be intent/stage matching alone.

**但它就是 intent/stage matching alone。** 程式碼的自述與行為相反。這比單純的缺漏更糟 —— 讀的人會以為路由是 uncertainty-anchored。

## 2. 根因:兩個東西都叫 uncertainty

| | 是什麼 | 誰要它 |
|---|---|---|
| **決策瓶頸的自然語言陳述** | 「法規天花板是否限制可主張的價值上限」 | `selectCapability` 強制要求(逼人講清楚) |
| **封閉詞彙的分類 token** | `workflow`、`evidence`、`user_need` | `filterCandidates` 拿去做 `includes()` 精確比對 |

兩者從未分離。實測:我實際呼叫時傳入的是一整句中文,`includes()` 對它做精確字串比對 —— **即使 244 筆 metadata 全部補齊,那句話也永遠不會 match 任何 token。** 補 metadata 救不了這個設計。

而封閉詞彙其實**已經存在**,在 `runtime/pdmCore.js`:

```js
const UNCERTAINTY_TYPE_TO_DELEGATE = Object.freeze({
  user_need, behavior, market, evidence,           // -> research
  experience, interaction, information_architecture,
  comprehension, workflow,                          // -> design
  implementation_validation, reliability,           // -> qa
  implementation,                                   // -> engineering
});
```

12 個 token,已經用於 specialist delegation。沒有人把它接到 capability routing。

## 3. 被忽略的那份 metadata 有多好

隨手取 registry 第一筆:

```json
"id": "capabilities:discovery-question-set",
"selection_cues": [
  "it is unclear who or what should be studied",
  "multiple plausible next steps exist and the right one is not obvious"
],
"anti_cues": [
  "the dominant uncertainty is already known",
  "the decision is purely about UX/interaction, not user/need evidence",
  "a full discovery cycle is clearly warranted (use discovery-process instead)"
],
"cost_profile": "low"
```

這些 cue **字面上就在講 dominant uncertainty**,而且寫得比任何 token 分類更有資訊量(`anti_cues` 甚至指名該改用哪個 capability)。它們躺在 registry 裡,被 244 筆完整填寫,然後被程式碼完全無視。

`cost_profile` 同理:`selectSmallestSufficient` 用的是寫死的 `TIER_RANK`(依 `type` 給 0/1/2),而不是每個 capability 自己宣告的成本。

## 4. 關鍵洞察:`filterCandidates` 在用程式碼做語意判斷,但呼叫它的是語言模型

`filterCandidates` 需要一個封閉分類法,唯一的理由是它想「自己」判斷 capability 合不合用。而它做得到的只有 `includes()` 字串比對 —— 所以它才需要 token,所以才需要有人去標 244 筆。

**但這個 runtime 的呼叫者是 PDM,而 PDM 是語言模型。** 語意判斷本來就該在那一層做。

這也正是 `orchestrator.js` 自己的原則:「**mechanism, not judgment**」。目前的設計違反了它自己的分層 —— 把判斷塞進 mechanism,結果判斷不了,只好要求一份不存在的 metadata。

**把 cue 交出去,讓模型判斷,分類法就不需要存在。**

## 5. 提案

### A. 把已經存在的 metadata 交出來(零 metadata 工作)

`filterCandidates` 的候選結果附帶 `selection_cues` / `anti_cues` / `cost_profile`,由 PDM 依 dominant uncertainty 做語意判斷。程式碼負責收斂候選(intent + stage,現行行為),模型負責選擇。

`selectSmallestSufficient` 改用 `cost_profile`,`TIER_RANK` 降為缺值時的 fallback。

### B. 分離兩個欄位

```js
selectCapability({
  dominantUncertainty,   // 必填、自然語言 —— 逼人講清楚,進 Work State 紀錄
  uncertaintyType,       // 選填、封閉 token —— 才拿來做硬過濾
  intents, decisionStage,
})
```

`uncertaintyType` 沿用 `pdmCore.js` 那 12 個 token。好處:capability routing 與 specialist delegation 從此共用同一套詞彙,`selectDelegate()` 也能直接吃同一個值。

### C. `uncertainty_types` 改為**用過才標**,永不批次猜測

只有當某個 capability 被實際選用、並確實解決了某類不確定性時,才把該 token 寫進它自己的 SKILL.md frontmatter,再 rebuild registry。

這正是 `ARCHITECTURE.md` §17 已經寫下的規則 ——「Missing uncertainty metadata is treated as unknown rather than invented」—— 批次補 244 筆就是 invent。

### D. 修掉那句不成立的自述

`orchestrator.js` 的錯誤訊息與 `ARCHITECTURE.md` §17 要改成描述實際行為:程式碼收斂候選,模型依 cue 判斷,`uncertaintyType` 在有宣告時才硬過濾。

## 6. 為什麼不選別的做法

| 做法 | 排除理由 |
|---|---|
| 人工補齊 244 筆 `uncertainty_types` | 昂貴、是猜測、違反 §17;而且**救不了**傳入自然語言句子的比對失敗 |
| 從 `theme` / `primary_intents` 自動推導 token | 一樣是 invent,只是自動化;且 registry 是 derived metadata,真正的源頭是 capability 檔案的 frontmatter |
| 接受現況只改文件 | 等於永久放棄一層已經填好的路由訊號 |

## 7. 風險

- **A 讓候選結果變大**(多帶 cue 文字),與 ARCHITECTURE §19 的 token 效率原則有張力。緩解:只對前 N 名候選帶 cue,不是全部。
- **B 是 API 破壞性變更**,會動到 `selectCapability` 既有呼叫端與測試。
- **C 讓 `uncertainty_types` 長期維持稀疏**,硬過濾長期幾乎不作用 —— 這是刻意的,證據累積前不假裝有分類法。

## 8. 需要 HH 回答

1. A（交出 cue、改用 cost_profile）要不要做?這是唯一零 metadata 成本、且立刻讓路由有意義的一項。
2. B 的欄位分離要不要一起做?它是破壞性變更,但不做的話 `dominantUncertainty` 會永遠是個被丟掉的參數。
3. C 的「用過才標」你認不認同?若不認同,替代方案就是接受 `uncertainty_types` 永遠不存在,並把它從架構文件裡拿掉。
