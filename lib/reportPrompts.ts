import type { ReportSessionData } from "@/types/report";

export const REPORT_SYSTEM_PROMPT = `あなたは音声コンテンツ分析レポート作成アシスタントです。
与えられた音声ログ、発話分析、検証結果をもとに、Clear後の最初のStartから現在までを対象にレポートを作成してください。
以下のルールを厳守してください。

1. 出力は必ずJSON
2. 音声全体の要約は短く、何の話だったかが一読でわかるように返す
3. 検証レポートは疑うべき点・肯定材料・否定材料を中心に返す
4. 断定を避け、「可能性」「示唆」「要確認」を使い分ける
5. transcript / inference / verification / external_check の範囲を超えて推測しない
6. Stop/Startで分断せず、同一report_session内では連続した分析対象として扱う
7. verificationに基づく裏取り状況と未確認事項を分けて書く
8. 日本語で簡潔に書く`;

export function buildReportPrompt(reportSession: ReportSessionData): string {
  return JSON.stringify(
    {
      report_session: reportSession,
      output_schema: {
        title: "short title",
        summary_overview: "音声全体が何について話されていたかを2-4文で説明",
        summary_topics: ["topic1", "topic2"],
        verification_overview:
          "疑うべき点、確認できた点、検証の限界をまとめた2-4文",
        caution_points: [
          {
            claim: "疑うべき点",
            note: "なぜ気になるか",
            sources: [{ title: "source title", url: "https://...", note: "根拠の要点" }]
          }
        ],
        supporting_points: [
          {
            claim: "肯定寄りに確認できた点",
            note: "確認理由",
            sources: [{ title: "source title", url: "https://...", note: "根拠の要点" }]
          }
        ],
        contradicting_points: [
          {
            claim: "否定寄りに確認できた点",
            note: "否定理由",
            sources: [{ title: "source title", url: "https://...", note: "根拠の要点" }]
          }
        ],
        open_questions: ["未解決の確認事項1", "未解決の確認事項2"]
      },
      writing_guide: [
        "対象範囲にはClear後最初のStart時刻と、最後のStopまたは記録継続中を明記する",
        "summary_overviewは音声全体が何について話していたのかを2-3文で簡潔に書く",
        "summary_topicsは箇条書き向きの短いフレーズにする",
        "verification_overviewは保存用ファイル向けに短くまとめる",
        "caution_pointsにはneeds_research, uncertain, mixed, insufficientの要素を優先して入れる",
        "supporting_pointsにはsupportedやlikely_ok寄りの材料を入れる",
        "contradicting_pointsにはcontradicted寄りの材料を入れる",
        "sourcesは最大3件、URLは実在のものだけを含める",
        "open_questionsは追加確認ポイントを3件以内で書く"
      ]
    },
    null,
    2
  );
}
