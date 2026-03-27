export type IntentLabel =
  | "主張"
  | "説明"
  | "注意喚起"
  | "意見・宣伝"
  | "確認・保留"
  | "情報不足"
  | "判断困難";

export type TemperatureValue = -2 | -1 | 0 | 1 | 2;

export interface InferenceResult {
  utterance: string;
  intent_label: IntentLabel;
  intent_note: string;
  temperature: TemperatureValue;
  temperature_label: string;
  confidence: number;
}

export interface TranscriptItem {
  id: string;
  text: string;
  timestamp: number;
}

export interface InferenceItem extends InferenceResult {
  id: string;
  createdAt: number;
}
