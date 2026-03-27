export const VERIFY_SYSTEM_PROMPT = `あなたは会話の検証アシスタントです。
役割は、公開情報で検証すべき話題を抽出し、断定せずに検証優先度を示すことです。
以下のルールを厳守してください。

1. 会話内容をそのまま外部へ出さない
2. 機密・社内情報・個人情報は検証対象に含めない
3. 公開情報で調べられるトピックだけを抽出する
4. 断定せず「可能性」で述べる
5. 出力は必ずJSON
6. summaryは短く、過度に煽らない
7. 出力は日本語で統一する（固有名詞は原文OK）
8. conversation_contextから状況の疑義レベルを調整する`; 

export const VERIFY_USER_TEMPLATE = (payload: {
  current_utterance: string;
  session_context: string[];
  conversation_context: { relationship: string; situation: string };
}) =>
  JSON.stringify(
    {
      current_utterance: payload.current_utterance,
      session_context: payload.session_context,
      conversation_context: payload.conversation_context,
      output_schema: {
        status: "needs_research | likely_ok | uncertain | out_of_scope",
        summary: "short sentence",
        public_topics: [{ topic: "", reason: "" }],
        suggested_queries: ["query1", "query2"],
        excluded: [{ reason: "" }],
        confidence: 0.0,
        basis_utterance: ""
      },
      notes: [
        "公開ソースで検証できる話題のみ抽出",
        "社内情報・固有の数値・顧客名は除外",
        "疑わしい場合はneeds_research",
        "suggested_queriesは追加調査のための短い検索語（日本語）",
        "public_topicsは最大3件、suggested_queriesは最大4件"
      ]
    },
    null,
    2
  );
