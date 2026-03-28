import type { InferenceItem, TranscriptItem } from "@/types/inference";
import type { VerificationResult } from "@/types/verification";

export type PopupPanelId =
  | "transcript"
  | "intent"
  | "verification"
  | "assistant";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface PopupStateSnapshot {
  updatedAt: number;
  status: string;
  contentType: string;
  analysisNote: string;
  transcriptItems: TranscriptItem[];
  liveUtterance: string;
  inferenceItems: InferenceItem[];
  latestVerification: VerificationResult | null;
  assistantMessages: AssistantMessage[];
  assistantLoading: boolean;
}

export type PopupChannelMessage =
  | { type: "snapshot"; snapshot: PopupStateSnapshot }
  | { type: "request_snapshot" }
  | { type: "assistant_request"; question: string };
