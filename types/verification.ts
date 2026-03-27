export type VerificationStatus =
  | "needs_research"
  | "likely_ok"
  | "uncertain"
  | "out_of_scope";

export interface VerificationTopic {
  topic: string;
  reason: string;
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
}
