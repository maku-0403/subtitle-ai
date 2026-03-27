export type VerificationStatus =
  | "needs_research"
  | "likely_ok"
  | "uncertain"
  | "out_of_scope";

export type EvidenceVerdict =
  | "supported"
  | "contradicted"
  | "mixed"
  | "insufficient"
  | "unavailable";

export interface VerificationTopic {
  topic: string;
  reason: string;
}

export interface VerificationSource {
  query: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  score: number;
  published_date?: string;
}

export interface ClaimCheck {
  claim: string;
  verdict: EvidenceVerdict;
  reason: string;
  source_urls: string[];
}

export interface ExternalCheckResult {
  enabled: boolean;
  verdict: EvidenceVerdict;
  summary: string;
  confidence: number;
  searched_queries: string[];
  sources: VerificationSource[];
  claim_checks: ClaimCheck[];
  error?: string;
}

export interface VerificationResult {
  id: string;
  createdAt: number;
  status: VerificationStatus;
  summary: string;
  public_topics: VerificationTopic[];
  suggested_queries: string[];
  excluded: { reason: string }[];
  confidence: number;
  basis_utterance: string;
  external_check: ExternalCheckResult;
}
