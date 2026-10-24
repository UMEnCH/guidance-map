# 面談思考マップ

保健指導の面談で「どの生活習慣に着目し → どこを掘り下げ → どんな情報提供をして → どの目標を立てるか」を、左から右へ枝分かれする樹形図でたどるツール。行動変容ステージ（無関心期〜維持期）ごとの目標例・情報提供文・図説・出典を参照し、ワンクリックでコピーできる。

- 公開: https://umench.github.io/guidance-map/
- HealthGuidanceEvaluator のサイドバー「ツール」と、対象者ビューの「思考マップ」リンクから開く
- 外部ライブラリなし。データはどこにも送信・保存しない

## ファイル

| ファイル | 内容 |
|---|---|
| `index.html` | 画面（樹形図・詳細パネル・コピー・コードの読み込み） |
| `data/core.js` | 出典の一覧（`GM.SRC`）・判定エンジン |
| `data/01-medication.js` 〜 `data/10-stress.js` | 大項目ごとの収録内容 |
| `data/rules.js` | 対象者に関係する項目の判定ルール |
| `figures/*.svg` | 図説 |

## 収録内容の編集

大項目ファイルの形:

```js
GM.add({ key:'diet_balance', name:'偏食', mids:[
  { id:'fast', name:'早食い', smalls:[
    { id:'fast_eating', title:'早食いは肥満・血糖上昇と関係がある',
      info:'情報提供の本文（\n で改行）',
      figure:'figures/fast-eating.svg', figCap:'図説の説明',
      sources:['program','jds2024'],          // GM.SRC のキー、または {title, pub, url}
      goals:{ '無関心期':[…], '関心期':[…], '準備期':[…], '実行期':[…], '維持期':[…] } } ] } ] });
```

- 中項目を足したら `data/rules.js` に同じ `id` で判定ルールを書く（書かなければ、その中項目は対象者を反映したときに常にグレー）
- 出典は公的機関・学会の資料に限り、URL が開けることを確かめてから `GM.SRC` に足す
- 大項目の `key` は HealthGuidanceEvaluator の生活習慣10項目のキーと同じにする

## 専用コード（HealthGuidanceEvaluator → 思考マップ）

`HGM1.` ＋ JSON を deflate-raw 圧縮して base64url にしたもの。対象者ビューが作り、URL の `#c=` で渡す（ハッシュはサーバーへ送られない）。読み込んだらハッシュは消し、何も保存しない。

```
{v:1, id, sex, dis:[病歴], med:[薬の分類], lab:{bmi:['27.4','high'], …},
 cat:{diet_balance:{o:'問題あり', st:'関心期', it:[['食事スピード','早食いである…'], …]}, …}}
```

氏名・薬剤名・自由記述は含めない。作る側は HealthGuidanceEvaluator の `sidebar_person.html`（`guideMapPayload` / `guideMapCode`）、往復の検査は `health-guidance-evaluator/scripts/test_guide_map.js`。

## 判定の見え方

- 左に橙の帯: この対象者に関係あり（理由をチップで表示）
- 点線の枠: 要聴取（「2回目以降の聴取予定」の項目がある）
- グレー: 関係なし（押せば見られる）
- 詳細パネルのステージは、二次情報のステージを初期表示にする
