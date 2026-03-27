import type {
  InferenceResult,
  IntentLabel,
  TemperatureValue
} from "@/types/inference";

export const INTENT_LABELS: IntentLabel[] = [
  "前向き",
  "条件付き前向き",
  "保留",
  "情報不足",
  "やんわり拒否",
  "社交辞令寄り",
  "判断困難"
];

export const TEMPERATURE_LABELS: Record<string, string> = {
  2: "高",
  1: "やや高",
  0: "中立",
  "-1": "やや低",
  "-2": "低"
};

export function fallbackInference(utterance = ""): InferenceResult {
  return {
    utterance,
    intent_label: "判断困難",
    intent_note: "推定根拠が不足",
    temperature: 0,
    temperature_label: TEMPERATURE_LABELS[0],
    confidence: 0
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(
  record: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function pickNumber(
  record: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toTemperature(value: unknown): TemperatureValue | null {
  if (value === 2 || value === 1 || value === 0 || value === -1 || value === -2) {
    return value;
  }
  return null;
}

export function normalizeInference(
  raw: unknown,
  utteranceFallback: string
): InferenceResult {
  if (!raw) {
    return fallbackInference(utteranceFallback);
  }

  const payload = isRecord(raw) ? raw : null;
  if (!payload) {
    return fallbackInference(utteranceFallback);
  }

  const utteranceRaw = pickString(payload, [
    "utterance",
    "text",
    "current_utterance",
    "currentUtterance"
  ]);
  const utterance =
    typeof utteranceRaw === "string" && utteranceRaw.trim().length > 0
      ? utteranceRaw.trim()
      : utteranceFallback;

  const intentLabelRaw = pickString(payload, [
    "intent_label",
    "intentLabel",
    "intent",
    "label"
  ]);
  const intentLabel = INTENT_LABELS.includes(intentLabelRaw as IntentLabel)
    ? (intentLabelRaw as IntentLabel)
    : "判断困難";

  const intentNoteRaw = pickString(payload, [
    "intent_note",
    "intentNote",
    "note",
    "reason"
  ]);
  const intentNote =
    typeof intentNoteRaw === "string"
      ? intentNoteRaw.trim().slice(0, 40)
      : "推定根拠が不足";

  const temperatureRaw = pickNumber(payload, [
    "temperature",
    "temp",
    "temperature_value",
    "temperatureValue"
  ]);
  const temperature = toTemperature(temperatureRaw) ?? 0;

  const confidenceRaw = pickNumber(payload, ["confidence", "score"]);
  const confidence = clampConfidence(confidenceRaw);

  return {
    utterance,
    intent_label: intentLabel,
    intent_note: intentNote || "推定根拠が不足",
    temperature,
    temperature_label: TEMPERATURE_LABELS[temperature],
    confidence
  };
}

export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}
