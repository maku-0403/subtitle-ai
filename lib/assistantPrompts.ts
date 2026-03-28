export const ASSISTANT_SYSTEM_PROMPT = `あなたは音声コンテンツ分析アシスタントです。
与えられた分析メモ、検証トピック、外部照合結果、追加の外部検索結果を踏まえ、簡潔に助言します。
以下のルールを厳守してください。

1. 自分で外部検索は行わず、与えられた外部照合結果と追加検索結果だけを参照する
2. 断定せず「可能性」「推奨」で表現する
3. 機密情報の推測や具体化はしない
4. 外部照合結果や追加検索結果に根拠不足がある場合はその限界を明記する
5. 出力は必ずJSONで返す
6. 回答は日本語で行う
7. 料金、仕様、最新情報など公開情報で答えられる質問では、追加検索結果を優先して要点をまとめる`;

export const buildAssistantUserPrompt = (payload: {
  question: string;
  content_context: { content_type: string; analysis_note: string };
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
  external_search: {
    query: string;
    answer?: string;
    results: {
      title: string;
      url: string;
      domain: string;
      snippet: string;
      published_date?: string;
    }[];
  } | null;
}) =>
  JSON.stringify(
    {
      question: payload.question,
      content_context: payload.content_context,
      latest_utterance: payload.latest_utterance,
      session_context: payload.session_context,
      verification_topics: payload.verification_topics,
      suggested_queries: payload.suggested_queries,
      external_check: payload.external_check,
      external_search: payload.external_search,
      output_schema: {
        answer: "short answer",
        followups: ["query1", "query2"]
      }
    },
    null,
    2
  );
