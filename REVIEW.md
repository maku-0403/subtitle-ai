# Code Review Report

**対象**: `さくらハッカソン2026/`
**日付**: 2026-03-28
**スタック**: Next.js 16 App Router / TypeScript / React 19 / Tailwind CSS / Sakura AI (STT+Chat) / Tavily Search

---

## Executive Summary

音声コンテンツのリアルタイム分析ダッシュボードとして機能的に完成度が高く、LLM応答の正規化・フォールバック処理など堅牢な部分も多い。一方で、**APIルートに認証が一切なく**コスト無制限に叩かれるリスク、**`app/page.tsx` への過剰な責務集中**、**テストゼロ**という3点が今後のスケールや信頼性において最大の課題。ハッカソン用途なら許容範囲だが、公開・継続開発するなら早急に対処が必要。

**総合健全性評価: Needs Work**

### Issue Count

| カテゴリ | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| Security | 1 | 2 | 2 | 1 | 1 |
| Performance | 0 | 1 | 3 | 2 | 0 |
| Code Quality | 0 | 2 | 3 | 3 | 1 |
| Architecture | 0 | 2 | 3 | 1 | 0 |
| Testing | 1 | 4 | 0 | 0 | 0 |

---

## Top Priority Actions

1. **全APIルートに認証を追加する** — 現状は誰でも無制限に `/api/verify` を叩けてTavily + Sakura Chat が何度でも消費される
2. **`console.log` でAPIペイロード全体をログ出力している箇所を削除** — `transcribe/route.ts:48-49`、`infer/route.ts:87-88`
3. **`app/page.tsx` を責務ごとに分割** — 録音・キュー処理・ポップアップ同期を独立モジュールへ
4. **`lib/validators.ts` と `lib/verify.ts` にテストを追加** — LLMの異常レスポンスに対するガード層であり最重要
5. **`/api/report` で受け取る `reportSession` をサーバー側でバリデーション** — 現状は型アサーションのみで実行時チェックなし

---

## Security Review

### Critical

**認証・認可なし — 全APIルートが無制限公開**
- 対象: `app/api/*/route.ts` 全5ファイル
- `/api/verify` は1リクエストで最大3件のTavily検索 + 2回のSakura Chat呼び出しをする。Nextアプリが公開されていれば誰でもコストを消費できる。
- 推奨: Next.js middleware でAPIキー認証またはセッションチェックを追加。ローカル専用ならCORSで絞ることも可。

### High

**`console.log` がAPIフルペイロードを出力**
- `app/api/transcribe/route.ts:48-49`、`app/api/infer/route.ts:87-88`
- Sakura APIの生レスポンス全体（`payload`オブジェクト）がサーバーログに出力される。本番環境ではAPIレスポンスが丸ごとログサービスに流れるリスクがある。
- 推奨: 開発時の `console.log` は削除するか `if (process.env.NODE_ENV !== "production")` で囲む。

**プロンプトインジェクションのリスク**
- 対象: `app/api/infer/route.ts`, `app/api/verify/route.ts`, `app/api/assistant/route.ts`
- ユーザーが入力する `analysisNote`・`contentType`、そして音声から生成される `currentUtterance`・`sessionContext` が無サニタイズでLLMプロンプトに注入される。
- 悪意ある音声コンテンツや `analysisNote` でLLMの指示上書き（ジェイルブレイク）が試みられる可能性がある。
- 推奨: `analysisNote` に文字数制限と改行除去を施す。システムプロンプトとユーザー入力の明確な境界をプロンプト設計で強化。

### Medium

**`/api/report` のボディは型アサーションのみ**
- `app/api/report/route.ts:436`: `body.reportSession as ReportSessionData`
- クライアントが意図的に巨大な `reportSession` を送ると、`buildReportPrompt` が生成するテキストが爆発しLLMトークン数が増大する可能性がある。
- 推奨: `transcripts`・`inferences`・`verifications` それぞれの件数に上限バリデーションを追加。

**レート制限なし**
- `/api/verify` は特にコストが高い（Tavily並列検索 → Sakura Chat 2回）にもかかわらず、呼び出し頻度の制限がない。
- 推奨: `vercel/kv` や `upstash/ratelimit` などで簡易レート制限を実装。

### Low / Info

**`.env.local` は `.gitignore` 済みで適切**
- `SAKURA_AI_API_KEY` 等は `.gitignore` で保護されている。問題なし。

---

## Performance Review

### High

**`computeContentTrust` が毎レンダーで再計算**
- `app/page.tsx:341-423` に定義されたこの関数は `verificationItems` 全体を走査する。`useMemo` が使われておらず、`verificationItems` が更新されるたびに再計算が走る。
- 推奨: `useMemo(() => computeContentTrust(verificationItems), [verificationItems])` でメモ化。

### Medium

**`syncAnalysisQueueState` の呼び出し過多**
- `app/page.tsx:616-623`: 4つのstateを同時更新するが、`stopRecording`・`clearSession` など複数の経路から頻繁に呼ばれる。
- 推奨: `useReducer` で4つのキュー状態を1つの state にまとめると更新が原子的になり可読性も上がる。

**`closeReportSegment` での不要な配列コピー**
- `app/page.tsx:702-703`: `[...prev.segments].reverse().findIndex(...)` — リバースのために配列コピーを作成。
- 推奨: `findLastIndex` または末尾からのループに変更。

**`buildSessionKeywordSet` がソースごとに再計算**
- `app/api/report/route.ts:84-96`: `isSourceLikelyRelevant` 内で `buildSessionKeywordSet(reportSession)` が source ごとに呼ばれる可能性があり O(n×m) になる。
- 推奨: `buildSessionKeywordSet` の結果を `filterClaimSources` の外でキャッシュして渡す。

### Low

**`rmsHistory` / `zcrHistory` のサイズ上限**
- `app/page.tsx:526-527`: `TONE_HISTORY_MAX=180` が定義されているが、実際のトリム処理が適切に行われているか確認が必要。長時間録音で際限なく伸びるとメモリリークになる。

**ポップアップ状態変化ごとに `localStorage` 同期書き込み**
- `localStorage` は同期APIのためメインスレッドをブロックする。ポップアップが開いていないときは書き込みをスキップすることを推奨。

---

## Code Quality Review

### High

**`app/page.tsx` が God Component**
- 900行超のファイルに、録音制御・音声解析・字幕整形・推論キュー・検証キュー・ポップアップ同期・レポート生成・UI描画がすべて詰まっている。`useRef` 20個以上、`useState` 20個以上。
- 推奨: 以下のカスタムフックに分離する。
  - `hooks/useRecorder.ts` — 録音・音声解析
  - `hooks/useInferenceQueue.ts` / `hooks/useVerifyQueue.ts` — キュー処理
  - `hooks/usePopupSync.ts` — ポップアップ同期

**デッドコード: 未使用コンポーネント**
- `components/ContentTrustMeter.tsx`・`components/TemperatureMeter.tsx` が存在するが `app/page.tsx` で使用されていない。`computeContentTrust` も計算されているが描画に使われていない可能性がある。
- 推奨: 将来使う予定がなければ削除。使う予定があればTODOコメントを追加。

### Medium

**UIスタイル定数が `page.tsx` に残留**
- `INTENT_TONE_CLASSES`・`VERIFY_STATUS_META`・`EXTERNAL_VERDICT_META` がロジックと同じファイルに混在している。
- 推奨: `constants/intentStyles.ts` 等に切り出す。

**全APIルートで同じボディパースパターンが重複**
- `app/api/infer`・`verify`・`report`・`assistant` の4ルートが「`request.json()` → 型チェック → フォールバック」のほぼ同一パターンを繰り返している。
- 推奨: 共通の `parseRequestBody` ユーティリティを `lib/` に切り出す。

**`sessionId` が実質的に使われていない**
- フロントエンドで生成してAPIに送っているが、APIルート側はほぼ無視している。
- 推奨: 使わないなら削除する。将来ログ用に使う場合はその旨のコメントを明記。

### Low

**`console.log` デバッグ出力がプロダクションコードに残存**（セキュリティ項目と重複）

**`isEnglishLike` の判定が単純すぎる**
- `app/page.tsx:182-187`: 「英字があって日本語がない」だけで英語判定しているため、URLや記号混じりの日本語テキストで誤判定する可能性がある。

**`fetchWithRetry` は network failure のみリトライ**
- `app/page.tsx:313-326`: HTTPエラー（500など）ではリトライしない。意図的なら問題ないが、コメントがないため意図が不明瞭。

---

## Architecture Review

### High

**`app/page.tsx` に全ビジネスロジックが集中**
- 録音制御・字幕整形・推論・検証・ポップアップ・レポートという6つの独立したドメインが単一のReactコンポーネントに混在。機能追加のたびに全体の影響を考慮する必要があり、バグの特定も困難。
- 推奨: 各ドメインを `hooks/` 以下のカスタムフックに分離し、`page.tsx` はオーケストレーター層に徹する。

**APIルートに共通ミドルウェアがない**
- 認証・エラーハンドリング・ロギングが各ルートにコピー実装されている。
- 推奨: `middleware.ts` でAPIキー検証を一元化、または `lib/withApiHandler.ts` のようなHOFでラップする。

### Medium

**ポップアップ同期の障害耐性が低い**
- `BroadcastChannel` がサポートされない環境でエラーになる可能性がある。クリーンアップ処理が `page.tsx` に埋め込まれており見落としやすい。
- 推奨: `usePopupSync` フックに集約し、`BroadcastChannel` 対応チェックを明示的に行う。

**クライアントが全セッションデータを `/api/report` に送信**
- 長時間録音では `reportSession` オブジェクトが非常に大きくなる。HTTP bodyサイズの上限設定もない。
- 推奨: Next.js の `bodyParser.sizeLimit` を設定する。または差分データのみを送る設計に変更。

**`sakuraFetch` / `tavilySearch` にタイムアウトがない**
- `lib/sakura.ts`・`lib/tavily.ts` のfetch呼び出しにタイムアウト設定がなく、APIが無応答のときルートがハングする。
- 推奨: `AbortController` でタイムアウトを設定（例: 15秒）。

### Low

**`sessionId` の設計が未完成**
- フロントエンドから送られているが使われていない。将来の拡張の布石であればコメントで意図を明記すべき。

---

## Testing Review

**テストが存在しません。カバレッジ 0%。**

`package.json` にテストスクリプトもテスト用依存関係（jest / vitest / testing-library 等）も存在しない。LLM出力を正規化するコードが多いこのアプリにとって高リスク。LLMの出力形式が変わったとき、または異常値が返ってきたとき、ガード層が機能しているかを確認する手段がない。

### 最優先で追加すべきテスト

| 優先度 | 対象 | 理由 |
|--------|------|------|
| High | `lib/validators.ts` — `extractJsonObject` | LLMの不正出力（マークダウン囲み・途中cut・入れ子JSON）を正しくパースできるか |
| High | `lib/validators.ts` — `normalizeInference` | `intent_label` が想定外の値のときフォールバックするか |
| High | `lib/verify.ts` — `normalizeVerification` | `status` が不明値のとき `uncertain` にフォールバックするか |
| High | `app/page.tsx` — `mergeUtterance`, `splitSentences`, `autoInsertCommas` | 日本語テキスト処理の境界ケース（空文字・句読点のみ・超長文） |
| High | `app/api/report/route.ts` — `buildFallbackReport` | `reportSession` が空やnullのケースでクラッシュしないか |
| Medium | `lib/audio.ts` — `pickSupportedMimeType` | 環境差異によるMIMEタイプ選択 |
| Medium | `app/api/report/route.ts` — `computeContentTrust` | スコアリングロジックの境界値（verifications=0, 全supported, 全contradicted） |

**推奨セットアップ**:

```bash
npm install -D vitest @vitest/ui
```

---

*Report generated by /codereview — multi-angle code review (security / performance / code quality / architecture / testing)*
