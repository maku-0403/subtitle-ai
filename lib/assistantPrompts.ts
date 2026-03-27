export const ASSISTANT_SYSTEM_PROMPT = `あなたは社内向けの検証・調査アシスタントです。
与えられた状況メモやトピックを踏まえ、簡潔に助言します。
以下のルールを厳守してください。

1. 外部検索は行わない前提で答える
2. 断定せず「可能性」「推奨」で表現する
3. 機密情報の推測や具体化はしない
4. 不確かな場合は「外部での確認を推奨」と述べる
5. 出力は必ずJSONで返す
6. 回答は日本語で行う`; 

export const buildAssistantUserPrompt = (payload: {
  question: string;
  conversation_context: { relationship: string; situation: string };
  latest_utterance: string;
  session_context: string[];
  verification_topics: { topic: string; reason: string }[];
  suggested_queries: string[];
}) =>
  JSON.stringify(
    {
      question: payload.question,
      conversation_context: payload.conversation_context,
      latest_utterance: payload.latest_utterance,
      session_context: payload.session_context,
      verification_topics: payload.verification_topics,
      suggested_queries: payload.suggested_queries,
      output_schema: {
        answer: "short answer",
        followups: ["query1", "query2"]
      }
    },
    null,
    2
  );
