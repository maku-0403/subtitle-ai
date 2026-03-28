import { NextResponse } from "next/server";
import { extractJsonObject } from "@/lib/validators";
import { REPORT_SYSTEM_PROMPT, buildReportPrompt } from "@/lib/reportPrompts";
import { getSakuraChatConfig, sakuraFetch } from "@/lib/sakura";
import type {
  GeneratedReport,
  ReportClaimItem,
  ReportSessionData,
  ReportSourceReference
} from "@/types/report";

export const runtime = "nodejs";

function formatDateTime(timestamp: number | null) {
  if (!timestamp) return "未開始";
  return new Date(timestamp).toLocaleString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "2-digit",
    day: "2-digit"
  });
}

function uniqueStrings(values: string[], limit = 4) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).slice(0, limit);
}

function dedupeSources(sources: ReportSourceReference[], limit = 3) {
  const seen = new Set<string>();
  const items: ReportSourceReference[] = [];
  for (const source of sources) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    items.push(source);
    if (items.length >= limit) break;
  }
  return items;
}

const SOURCE_BLOCKLIST = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "facebook.com"
];

const SOURCE_STOP_WORDS = new Set([
  "する",
  "して",
  "ある",
  "いる",
  "こと",
  "ため",
  "これ",
  "それ",
  "さん",
  "です",
  "ます",
  "した",
  "してる",
  "from",
  "with",
  "that",
  "this",
  "what",
  "about",
  "have"
]);

function extractKeywords(text: string) {
  const matches = text
    .toLowerCase()
    .match(/[a-z0-9]{3,}|[一-龯ぁ-んァ-ン]{2,}/g);
  if (!matches) return [];
  return matches.filter((token) => !SOURCE_STOP_WORDS.has(token));
}

function buildSessionKeywordSet(reportSession: ReportSessionData) {
  const corpus = [
    ...reportSession.transcripts.map((item) => item.text),
    ...reportSession.segments.map((item) => item.analysisNote),
    ...reportSession.verifications.map((item) => item.summary),
    ...reportSession.verifications.flatMap((item) =>
      item.public_topics.map((topic) => `${topic.topic} ${topic.reason}`)
    ),
    ...reportSession.verifications.flatMap((item) => item.suggested_queries)
  ].join(" ");

  return new Set(extractKeywords(corpus));
}

function isSourceLikelyRelevant(
  source: ReportSourceReference,
  reportSession: ReportSessionData,
  relatedTexts: string[]
) {
  try {
    const url = new URL(source.url);
    const hostname = url.hostname.toLowerCase();
    if (SOURCE_BLOCKLIST.some((domain) => hostname.includes(domain))) {
      return false;
    }
  } catch {
    return false;
  }

  const sessionKeywords = buildSessionKeywordSet(reportSession);
  const sourceText = `${source.title} ${source.note}`.toLowerCase();
  const relatedKeywordSet = new Set(
    extractKeywords(relatedTexts.join(" ")).filter(Boolean)
  );
  const matchedRelated = Array.from(relatedKeywordSet).filter((keyword) =>
    sourceText.includes(keyword)
  ).length;
  const matchedSession = Array.from(sessionKeywords).filter((keyword) =>
    sourceText.includes(keyword)
  ).length;

  return matchedRelated > 0 || matchedSession >= 2;
}

function filterClaimSources(
  sources: ReportSourceReference[],
  reportSession: ReportSessionData,
  relatedTexts: string[]
) {
  return dedupeSources(
    sources.filter((source) =>
      isSourceLikelyRelevant(source, reportSession, relatedTexts)
    )
  );
}

function buildDownloadMarkdown(report: Omit<GeneratedReport, "generatedAt" | "sourceVersion">, reportSession: ReportSessionData) {
  const renderClaimList = (title: string, items: ReportClaimItem[]) => {
    if (items.length === 0) {
      return `## ${title}\n- 該当なし`;
    }
    return [
      `## ${title}`,
      ...items.flatMap((item) => [
        `- ${item.claim}`,
        `  - ${item.note}`,
        ...item.sources.map(
          (source) => `  - ${source.title} (${source.url}) : ${source.note}`
        )
      ])
    ].join("\n");
  };

  return [
    `# ${report.title}`,
    "",
    "## 対象範囲",
    `- Clear時刻: ${formatDateTime(reportSession.clearAt)}`,
    `- 初回Start: ${formatDateTime(reportSession.firstStartAt)}`,
    `- 最終Stop: ${formatDateTime(reportSession.lastStopAt)}`,
    `- 録音区間: ${reportSession.segments.length}回`,
    `- 発話 / 分析 / 検証: ${reportSession.transcripts.length} / ${reportSession.inferences.length} / ${reportSession.verifications.length}`,
    "",
    "## 音声全体の要約",
    report.summaryOverview,
    "",
    ...report.summaryTopics.map((topic) => `- ${topic}`),
    "",
    "## 全体の検証レポート",
    report.verificationOverview,
    "",
    renderClaimList("疑うべき点", report.cautionPoints),
    "",
    renderClaimList("肯定寄りに確認できた点", report.supportingPoints),
    "",
    renderClaimList("否定寄りに確認できた点", report.contradictingPoints),
    "",
    "## 未解決の確認事項",
    ...(report.openQuestions.length > 0
      ? report.openQuestions.map((item) => `- ${item}`)
      : ["- 追加確認事項はありません"])
  ].join("\n");
}

function buildFallbackReport(reportSession: ReportSessionData): Omit<
  GeneratedReport,
  "generatedAt" | "sourceVersion"
> {
  const summaryTopics = uniqueStrings([
    ...reportSession.verifications.flatMap((item) =>
      item.public_topics.map((topic) => topic.topic)
    ),
    ...reportSession.inferences.map((item) => item.intent_label)
  ]);

  const cautionPoints = uniqueStrings(
    reportSession.verifications.flatMap((item) => [
      item.status === "needs_research" || item.status === "uncertain"
        ? item.summary
        : "",
      ...item.external_check.claim_checks
        .filter((check) => check.verdict === "mixed" || check.verdict === "insufficient")
        .map((check) => check.claim)
    ]),
    3
  ).map<ReportClaimItem>((claim) => {
    const matchedVerification = reportSession.verifications.find(
      (item) =>
        item.summary === claim ||
        item.external_check.claim_checks.some((check) => check.claim === claim)
    );
    const sources = dedupeSources(
      (matchedVerification?.external_check.sources ?? []).map((source) => ({
        title: source.title,
        url: source.url,
        note: source.snippet || source.query
      }))
    );
    return {
      claim,
      note: matchedVerification?.summary ?? "追加確認が必要な可能性があります。",
      sources: filterClaimSources(
        sources,
        reportSession,
        [claim, matchedVerification?.summary ?? ""]
      )
    };
  });

  const supportingPoints = reportSession.verifications
    .flatMap((item) =>
      item.external_check.claim_checks
        .filter((check) => check.verdict === "supported")
        .map<ReportClaimItem>((check) => ({
          claim: check.claim,
          note: check.reason,
          sources: filterClaimSources(
            item.external_check.sources
              .filter((source) => check.source_urls.includes(source.url))
              .map((source) => ({
                title: source.title,
                url: source.url,
                note: source.snippet || source.query
              })),
            reportSession,
            [check.claim, check.reason, item.summary]
          )
        }))
    )
    .slice(0, 3);

  const contradictingPoints = reportSession.verifications
    .flatMap((item) =>
      item.external_check.claim_checks
        .filter((check) => check.verdict === "contradicted")
        .map<ReportClaimItem>((check) => ({
          claim: check.claim,
          note: check.reason,
          sources: filterClaimSources(
            item.external_check.sources
              .filter((source) => check.source_urls.includes(source.url))
              .map((source) => ({
                title: source.title,
                url: source.url,
                note: source.snippet || source.query
              })),
            reportSession,
            [check.claim, check.reason, item.summary]
          )
        }))
    )
    .slice(0, 3);

  const openQuestions = uniqueStrings([
    ...reportSession.verifications.flatMap((item) => item.suggested_queries),
    ...reportSession.verifications.flatMap((item) =>
      item.excluded.map((entry) => entry.reason)
    )
  ], 3);

  const summaryOverview =
    reportSession.transcripts.length > 0
      ? `この音声では、${summaryTopics.length > 0 ? summaryTopics.join("、") : "複数の論点"}が扱われています。発話数は${reportSession.transcripts.length}件で、Clear後の最初のStartから複数区間を通して記録しています。`
      : "音声全体を要約するには発話がまだ不足しています。";

  const verificationOverview = `検証結果は ${reportSession.verifications.length} 件あります。要確認になった項目や、公開ソースで支持・否定された主張を以下に整理しています。`;

  const title = "空気の裏字幕 検証レポート";
  const report = {
    title,
    summaryOverview,
    summaryTopics,
    verificationOverview,
    cautionPoints,
    supportingPoints,
    contradictingPoints,
    openQuestions,
    downloadMarkdown: ""
  };

  return {
    ...report,
    downloadMarkdown: buildDownloadMarkdown(report, reportSession)
  };
}

function normalizeClaimItem(
  value: unknown,
  reportSession: ReportSessionData
): ReportClaimItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    claim?: unknown;
    note?: unknown;
    sources?: unknown[];
  };
  const claim =
    typeof item.claim === "string" && item.claim.trim() ? item.claim.trim() : "";
  const note =
    typeof item.note === "string" && item.note.trim()
      ? item.note.trim()
      : "根拠の確認が必要です。";
  if (!claim) return null;
  const sources = Array.isArray(item.sources)
    ? item.sources
        .map((source) => {
          if (!source || typeof source !== "object") return null;
          const entry = source as {
            title?: unknown;
            url?: unknown;
            note?: unknown;
          };
          const title =
            typeof entry.title === "string" && entry.title.trim()
              ? entry.title.trim()
              : "参照ソース";
          const url =
            typeof entry.url === "string" && entry.url.trim() ? entry.url.trim() : "";
          const entryNote =
            typeof entry.note === "string" && entry.note.trim()
              ? entry.note.trim()
              : "";
          if (!url) return null;
          return { title, url, note: entryNote };
        })
        .filter((source): source is ReportSourceReference => source !== null)
    : [];

  return {
    claim,
    note,
    sources: filterClaimSources(sources, reportSession, [claim, note])
  };
}

function normalizeStructuredReport(
  parsed: unknown,
  reportSession: ReportSessionData
): Omit<GeneratedReport, "generatedAt" | "sourceVersion"> {
  const fallback = buildFallbackReport(reportSession);
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }
  const value = parsed as Record<string, unknown>;
  const title =
    typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : fallback.title;
  const summaryOverview =
    typeof value.summary_overview === "string" && value.summary_overview.trim()
      ? value.summary_overview.trim()
      : fallback.summaryOverview;
  const summaryTopics = Array.isArray(value.summary_topics)
    ? uniqueStrings(
        value.summary_topics.filter((item): item is string => typeof item === "string"),
        5
      )
    : fallback.summaryTopics;
  const verificationOverview =
    typeof value.verification_overview === "string" &&
    value.verification_overview.trim()
      ? value.verification_overview.trim()
      : fallback.verificationOverview;
  const cautionPoints = Array.isArray(value.caution_points)
    ? value.caution_points
        .map((item) => normalizeClaimItem(item, reportSession))
        .filter((item): item is ReportClaimItem => item !== null)
        .slice(0, 4)
    : fallback.cautionPoints;
  const supportingPoints = Array.isArray(value.supporting_points)
    ? value.supporting_points
        .map((item) => normalizeClaimItem(item, reportSession))
        .filter((item): item is ReportClaimItem => item !== null)
        .slice(0, 4)
    : fallback.supportingPoints;
  const contradictingPoints = Array.isArray(value.contradicting_points)
    ? value.contradicting_points
        .map((item) => normalizeClaimItem(item, reportSession))
        .filter((item): item is ReportClaimItem => item !== null)
        .slice(0, 4)
    : fallback.contradictingPoints;
  const openQuestions = Array.isArray(value.open_questions)
    ? uniqueStrings(
        value.open_questions.filter((item): item is string => typeof item === "string"),
        4
      )
    : fallback.openQuestions;

  const report = {
    title,
    summaryOverview,
    summaryTopics,
    verificationOverview,
    cautionPoints,
    supportingPoints,
    contradictingPoints,
    openQuestions,
    downloadMarkdown: ""
  };

  return {
    ...report,
    downloadMarkdown: buildDownloadMarkdown(report, reportSession)
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reportSession =
      body?.reportSession && typeof body.reportSession === "object"
        ? (body.reportSession as ReportSessionData)
        : null;

    if (!reportSession || !reportSession.firstStartAt) {
      return NextResponse.json(
        {
          title: "",
          summaryOverview: "",
          summaryTopics: [],
          verificationOverview: "",
          cautionPoints: [],
          supportingPoints: [],
          contradictingPoints: [],
          openQuestions: [],
          downloadMarkdown: "",
          error: "Report session is empty"
        },
        { status: 400 }
      );
    }

    const fallback = buildFallbackReport(reportSession);
    const config = getSakuraChatConfig();
    if (!config) {
      return NextResponse.json(fallback);
    }

    const response = await sakuraFetch("/chat/completions", config, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.chatModel,
        messages: [
          { role: "system", content: REPORT_SYSTEM_PROMPT },
          { role: "user", content: buildReportPrompt(reportSession) }
        ],
        temperature: 0.2,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        ...fallback,
        error: `Sakura Chat error ${response.status}: ${errorText || "unknown"}`
      });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({
        ...fallback,
        error: "Empty response from model"
      });
    }

    const parsed = extractJsonObject(content);
    return NextResponse.json(normalizeStructuredReport(parsed, reportSession));
  } catch (error) {
    console.error("Report error", error);
    return NextResponse.json(
      {
        title: "",
        summaryOverview: "",
        summaryTopics: [],
        verificationOverview: "",
        cautionPoints: [],
        supportingPoints: [],
        contradictingPoints: [],
        openQuestions: [],
        downloadMarkdown: "",
        error: "Server error"
      },
      { status: 500 }
    );
  }
}
