export const ASSISTANT_SYSTEM_PROMPT = `あなたは社内向けの検証・調査アシスタントです。
与えられた状況メモ、検証トピック、外部照合結果を踏まえ、簡潔に助言します。
以下のルールを厳守してください。

1. 自分で外部検索は行わず、与えられた外部照合結果だけを参照する
2. 断定せず「可能性」「推奨」で表現する
3. 機密情報の推測や具体化はしない
4. 外部照合結果に根拠不足がある場合はその限界を明記する
5. 出力は必ずJSONで返す
6. 回答は日本語で行う`; 

export const buildAssistantUserPrompt = (payload: {
  question: string;
  conversation_context: { relationship: string; situation: string };
  latest_utterance: string;
  session_context: string[];
  verification_topics: { topic: string; reason: string }[];
  suggested_queries: string[];
  external_check: {
    verdict: string;
    summary: string;
    claim_checks: { claim: string; verdict: string; reason: string }[];
    sources: { title: string; url: string; domain: string; snippet: string }[];
  } | null;
}) =>
  JSON.stringify(
    {
      question: payload.question,
      conversation_context: payload.conversation_context,
      latest_utterance: payload.latest_utterance,
      session_context: payload.session_context,
      verification_topics: payload.verification_topics,
      suggested_queries: payload.suggested_queries,
      external_check: payload.external_check,
      output_schema: {
        answer: "short answer",
        followups: ["query1", "query2"]
      }
    },
    null,
    2
  );
