import type { InferenceItem, TranscriptItem } from "@/types/inference";
import type { VerificationResult } from "@/types/verification";

export interface ReportSegment {
  id: string;
  startAt: number;
  stopAt: number | null;
  captureMode: "tab" | "mic";
  contentType: string;
  analysisNote: string;
}

export interface ReportSessionData {
  id: string | null;
  clearAt: number;
  firstStartAt: number | null;
  lastStopAt: number | null;
  segments: ReportSegment[];
  transcripts: TranscriptItem[];
  inferences: InferenceItem[];
  verifications: VerificationResult[];
}

export interface ReportSourceReference {
  title: string;
  url: string;
  note: string;
}

export interface ReportClaimItem {
  claim: string;
  note: string;
  sources: ReportSourceReference[];
}

export interface GeneratedReport {
  title: string;
  summaryOverview: string;
  summaryTopics: string[];
  verificationOverview: string;
  cautionPoints: ReportClaimItem[];
  supportingPoints: ReportClaimItem[];
  contradictingPoints: ReportClaimItem[];
  openQuestions: string[];
  downloadMarkdown: string;
  generatedAt: number;
  sourceVersion: number;
}
