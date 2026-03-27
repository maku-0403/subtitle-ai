import type { VerificationResult, VerificationStatus } from "@/types/verification";

const STATUSES: VerificationStatus[] = [
  "needs_research",
  "likely_ok",
  "uncertain",
  "out_of_scope"
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
    basis_utterance: utterance
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
      ? raw.summary.trim().slice(0, 60)
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
    basis_utterance: basisUtterance
  };
}
