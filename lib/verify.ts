import type {
  ClaimCheck,
  ExternalCheckResult,
  EvidenceVerdict,
  VerificationResult,
  VerificationSource,
  VerificationStatus
} from "@/types/verification";

const STATUSES: VerificationStatus[] = [
  "needs_research",
  "likely_ok",
  "uncertain",
  "out_of_scope"
];

const EVIDENCE_VERDICTS: EvidenceVerdict[] = [
  "supported",
  "contradicted",
  "mixed",
  "insufficient",
  "unavailable"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value.trim();
    }
  }
  return "";
}

function pickStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toVerdict(value: unknown): EvidenceVerdict {
  return EVIDENCE_VERDICTS.includes(value as EvidenceVerdict)
    ? (value as EvidenceVerdict)
    : "insufficient";
}

function buildUnavailableExternalCheck(
  overrides?: Partial<ExternalCheckResult>
): ExternalCheckResult {
  return {
    enabled: false,
    verdict: "unavailable",
    summary: "外部検索は未実行です。",
    confidence: 0,
    searched_queries: [],
    sources: [],
    claim_checks: [],
    ...overrides
  };
}

function normalizeSource(raw: unknown): VerificationSource | null {
  if (!isRecord(raw)) return null;
  const url = pickString(raw, ["url"]);
  if (!url) return null;
  const title = pickString(raw, ["title"]).slice(0, 120);
  const snippet = pickString(raw, ["snippet", "content"]).slice(0, 280);
  const query = pickString(raw, ["query"]).slice(0, 80);
  const publishedDate = pickString(raw, [
    "published_date",
    "publishedDate",
    "date"
  ]).slice(0, 40);
  let domain = pickString(raw, ["domain"]).slice(0, 80);
  if (!domain) {
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      domain = "";
    }
  }
  return {
    query,
    title: title || url,
    url,
    snippet,
    domain,
    score:
      typeof raw.score === "number" && !Number.isNaN(raw.score) ? raw.score : 0,
    published_date: publishedDate || undefined
  };
}

function normalizeClaimCheck(raw: unknown, sources: VerificationSource[]): ClaimCheck | null {
  if (!isRecord(raw)) return null;
  const claim = pickString(raw, ["claim"]).slice(0, 120);
  if (!claim) return null;
  const sourceUrls = pickStringArray(raw, "source_urls")
    .filter((url) => sources.some((source) => source.url === url))
    .slice(0, 3);

  return {
    claim,
    verdict: toVerdict(raw.verdict),
    reason: pickString(raw, ["reason", "summary"]).slice(0, 160) || "根拠が不足しています。",
    source_urls: sourceUrls
  };
}

export function fallbackVerification(
  utterance: string,
  status: VerificationStatus = "uncertain"
): Omit<VerificationResult, "id" | "createdAt"> {
  return {
    status,
    summary: "要確認の可能性があります",
    public_topics: [],
    suggested_queries: [],
    excluded: [],
    confidence: 0,
    basis_utterance: utterance,
    external_check: buildUnavailableExternalCheck()
  };
}

export function normalizeVerification(
  raw: unknown,
  utterance: string
): Omit<VerificationResult, "id" | "createdAt"> {
  if (!raw || !isRecord(raw)) {
    return fallbackVerification(utterance);
  }

  const status = STATUSES.includes(raw.status as VerificationStatus)
    ? (raw.status as VerificationStatus)
    : "uncertain";

  const summary =
    typeof raw.summary === "string" && raw.summary.trim().length > 0
      ? raw.summary.trim()
      : "要確認の可能性があります";

  const publicTopics = Array.isArray(raw.public_topics)
    ? raw.public_topics
        .map((item) => {
          if (!isRecord(item)) return null;
          const topic = typeof item.topic === "string" ? item.topic.trim() : "";
          const reason =
            typeof item.reason === "string" ? item.reason.trim() : "";
          if (!topic) return null;
          return { topic: topic.slice(0, 40), reason: reason.slice(0, 60) };
        })
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const suggestedQueries = Array.isArray(raw.suggested_queries)
    ? raw.suggested_queries
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 6)
    : [];
  const uniqueQueries = Array.from(
    new Map(suggestedQueries.map((item) => [item.replace(/\s+/g, ""), item])).values()
  );

  const excluded = Array.isArray(raw.excluded)
    ? raw.excluded
        .map((item) => {
          if (!isRecord(item)) return null;
          const reason =
            typeof item.reason === "string" ? item.reason.trim() : "";
          if (!reason) return null;
          return { reason: reason.slice(0, 60) };
        })
        .filter(Boolean)
    : [];

  const basisUtterance =
    typeof raw.basis_utterance === "string" && raw.basis_utterance.trim()
      ? raw.basis_utterance.trim().slice(0, 120)
      : utterance;

  return {
    status,
    summary,
    public_topics: publicTopics as { topic: string; reason: string }[],
    suggested_queries: uniqueQueries,
    excluded: excluded as { reason: string }[],
    confidence: clampConfidence(raw.confidence),
    basis_utterance: basisUtterance,
    external_check: buildUnavailableExternalCheck()
  };
}

export function buildVerificationQueries(
  suggestedQueries: string[],
  publicTopics: { topic: string; reason: string }[]
): string[] {
  const merged = [
    ...suggestedQueries,
    ...publicTopics.map((item) => item.topic)
  ]
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);

  return Array.from(
    new Map(merged.map((item) => [item.replace(/\s+/g, ""), item])).values()
  ).slice(0, 3);
}

export function normalizeExternalCheck(
  raw: unknown,
  fallbackQueries: string[],
  fallbackSources: VerificationSource[],
  enabled = true
): ExternalCheckResult {
  if (!raw || !isRecord(raw)) {
    return buildUnavailableExternalCheck({
      enabled,
      searched_queries: fallbackQueries.slice(0, 3),
      sources: fallbackSources.slice(0, 6),
      summary: fallbackSources.length
        ? "外部ソースは取得しましたが、判定の整形に失敗しました。"
        : "外部ソースの根拠が不足しています。",
      verdict: fallbackSources.length ? "insufficient" : "unavailable"
    });
  }

  const sources = Array.isArray(raw.sources)
    ? raw.sources
        .map((item) => normalizeSource(item))
        .filter(Boolean)
        .slice(0, 6)
    : fallbackSources.slice(0, 6);

  const claimChecks = Array.isArray(raw.claim_checks)
    ? raw.claim_checks
        .map((item) => normalizeClaimCheck(item, sources as VerificationSource[]))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const searchedQueries = pickStringArray(raw, "searched_queries");
  const summary =
    pickString(raw, ["summary"]).slice(0, 180) ||
    (sources.length > 0
      ? "外部ソースに基づく追加確認が必要です。"
      : "外部ソースの根拠が不足しています。");

  return {
    enabled,
    verdict: toVerdict(raw.verdict),
    summary,
    confidence: clampConfidence(raw.confidence),
    searched_queries:
      searchedQueries.length > 0 ? searchedQueries.slice(0, 3) : fallbackQueries.slice(0, 3),
    sources: (sources as VerificationSource[]).slice(0, 6),
    claim_checks: claimChecks as ClaimCheck[],
    error: pickString(raw, ["error"]).slice(0, 160) || undefined
  };
}

export function unavailableExternalCheck(
  summary: string,
  queries: string[],
  enabled: boolean,
  error?: string
): ExternalCheckResult {
  return buildUnavailableExternalCheck({
    enabled,
    summary: summary.slice(0, 180),
    searched_queries: queries.slice(0, 3),
    error: error?.slice(0, 160)
  });
}
