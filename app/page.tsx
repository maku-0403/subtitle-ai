"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CaptureControls from "@/components/CaptureControls";
import TranscriptPanel from "@/components/TranscriptPanel";
import IntentPanel from "@/components/IntentPanel";
import TemperatureMeter from "@/components/TemperatureMeter";
import { pickSupportedMimeType } from "@/lib/audio";
import type { InferenceItem, TranscriptItem } from "@/types/inference";
import type {
  EvidenceVerdict,
  VerificationResult,
  VerificationStatus
} from "@/types/verification";

const CONTEXT_WINDOW_MS = 15_000;
const CONTEXT_MAX_ITEMS = 8;
const SESSION_CONTEXT_MAX_ITEMS = 20;
const MAX_TRANSCRIPT_ITEMS = 60;
const MAX_INFERENCE_ITEMS = 60;
const CHUNK_MS = 2000;
const SEND_EVERY_CHUNKS = 2;
const SILENCE_FINALIZE_CHUNKS = 2;
const GAP_FINALIZE_MS = 4500;
const TONE_HISTORY_MAX = 180;
const SILENCE_RMS_THRESHOLD = 0.025;
const SILENCE_SPEECH_RATIO_THRESHOLD = 0.2;
const INFERENCE_REFRESH_MS = 2200;
const INFERENCE_QUEUE_GAP_BASE_MS = 320;
const INFERENCE_QUEUE_GAP_PER_CHAR_MS = 10;
const INFERENCE_QUEUE_GAP_MAX_MS = 900;
const INFERENCE_MIN_DELTA_CHARS = 4;
const LIVE_MIN_INFER_CHARS = 8;
const LIVE_SOFT_SPLIT_MS = 6500;
const LIVE_SOFT_SPLIT_CHARS = 45;
const LIVE_SOFT_SPLIT_MIN_HEAD = 12;
const LIVE_SOFT_SPLIT_MIN_TAIL = 6;
const VERIFY_QUEUE_GAP_MS = 20000;
const VERIFY_MIN_CHARS = 14;
const VERIFY_COOLDOWN_MS = 30000;

const END_PUNCTUATION = /[。！？!?.]$/;
const CONTINUATION_TRAIL = /(ので|から|けど|ですが|だが|けれど|と思|って|という|のでしょう|ですけど|かな|かも)$/;
const LIKELY_FINISH = /(です|ます|でした|ました|ですね|でしょう|と思います|だと思います)$/;
const SILENCE_PHRASES = new Set([
  "ご視聴ありがとうございました",
  "ありがとうございました",
  "はい",
  "はい。",
  "はい、",
  "えー",
  "ええ",
  "うん",
  "うーん"
]);

const INTENT_TONE_CLASSES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  前向き: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  条件付き前向き: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700" },
  保留: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  情報不足: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  やんわり拒否: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  社交辞令寄り: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" },
  判断困難: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500" }
};

const VERIFY_STATUS_META: Record<
  VerificationStatus,
  { label: string; color: string; border: string; bg: string }
> = {
  needs_research: {
    label: "要確認",
    color: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50"
  },
  likely_ok: {
    label: "一致の可能性",
    color: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50"
  },
  uncertain: {
    label: "不明",
    color: "text-slate-600",
    border: "border-slate-200",
    bg: "bg-slate-50"
  },
  out_of_scope: {
    label: "対象外",
    color: "text-slate-500",
    border: "border-slate-200",
    bg: "bg-slate-50"
  }
};

const EXTERNAL_VERDICT_META: Record<
  EvidenceVerdict,
  { label: string; color: string; border: string; bg: string }
> = {
  supported: {
    label: "根拠あり",
    color: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50"
  },
  contradicted: {
    label: "矛盾あり",
    color: "text-rose-700",
    border: "border-rose-200",
    bg: "bg-rose-50"
  },
  mixed: {
    label: "根拠混在",
    color: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50"
  },
  insufficient: {
    label: "根拠不足",
    color: "text-slate-600",
    border: "border-slate-200",
    bg: "bg-slate-50"
  },
  unavailable: {
    label: "未実行",
    color: "text-slate-500",
    border: "border-slate-200",
    bg: "bg-slate-50"
  }
};

function mergeUtterance(prev: string, next: string): string {
  const a = prev.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith(b)) return a;
  const max = Math.min(12, a.length, b.length);
  for (let i = max; i > 0; i -= 1) {
    if (a.slice(-i) === b.slice(0, i)) {
      return a + b.slice(i);
    }
  }
  return a + b;
}

function isLikelyFinal(latest: string, merged: string, gapMs: number): boolean {
  const trimmed = latest.trim();
  if (!trimmed) return false;
  if (gapMs > GAP_FINALIZE_MS) return true;
  if (END_PUNCTUATION.test(trimmed)) return true;
  if (trimmed.endsWith("、")) return false;
  if (CONTINUATION_TRAIL.test(trimmed)) return false;
  if (trimmed.length < 8) return false;
  if (merged.length < 12) return false;
  return LIKELY_FINISH.test(trimmed);
}

function isEnglishLike(text: string): boolean {
  if (!text) return false;
  const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  return hasLatin && !hasJapanese;
}

function splitSentences(text: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let buffer = "";
  for (const char of text) {
    buffer += char;
    if (/[。！？!?.]/.test(char)) {
      const trimmed = buffer.trim();
      if (trimmed) {
        sentences.push(trimmed);
      }
      buffer = "";
    }
  }
  const remainder = buffer.trim();
  return { sentences, remainder };
}

const COMMA_CUES = [
  "ですが",
  "けど",
  "けれど",
  "なので",
  "ので",
  "から",
  "そして",
  "また",
  "ただ",
  "一方で",
  "つまり",
  "それで",
  "しかし",
  "ですけど"
];

function autoInsertCommas(text: string): string {
  let output = text;
  if (output.length < 12) return output;
  for (const cue of COMMA_CUES) {
    const pattern = new RegExp(`${cue}(?![、。！？!?])`, "g");
    output = output.replace(pattern, `${cue}、`);
  }
  const punctuationCount = (output.match(/[、。！？!?]/g) || []).length;
  if (punctuationCount === 0 && output.length > 28) {
    const windowStart = Math.max(0, output.length - 30);
    const windowText = output.slice(windowStart);
    const particleMatch = windowText.match(/(は|が|を|に|で|と|も|へ|の|や)(?![、。！？!?])(?=.{6,16}$)/);
    if (particleMatch && particleMatch.index !== undefined) {
      const insertAt = windowStart + particleMatch.index + particleMatch[0].length;
      output = `${output.slice(0, insertAt)}、${output.slice(insertAt)}`;
    }
  }
  return output;
}

function softSplitAtComma(text: string): { head: string; tail: string } | null {
  const candidates = ["、", "，", ","];
  let splitIndex = -1;
  for (const symbol of candidates) {
    const idx = text.lastIndexOf(symbol);
    if (idx > splitIndex) {
      splitIndex = idx;
    }
  }
  if (splitIndex <= 0) return null;
  const head = text.slice(0, splitIndex + 1).trim();
  const tail = text.slice(splitIndex + 1).trim();
  if (
    head.length < LIVE_SOFT_SPLIT_MIN_HEAD ||
    tail.length < LIVE_SOFT_SPLIT_MIN_TAIL
  ) {
    return null;
  }
  return { head, tail };
}

function computeQueueDelay(utterance: string): number {
  const length = utterance.trim().length;
  const raw =
    INFERENCE_QUEUE_GAP_BASE_MS + length * INFERENCE_QUEUE_GAP_PER_CHAR_MS;
  return Math.max(
    INFERENCE_QUEUE_GAP_BASE_MS,
    Math.min(INFERENCE_QUEUE_GAP_MAX_MS, Math.round(raw))
  );
}

function computeToneMetrics(rmsValues: number[], zcrValues: number[]) {
  if (rmsValues.length === 0) {
    return {
      avg_rms: 0,
      rms_std: 0,
      speech_ratio: 0,
      zcr: 0,
      energy_label: "low",
      pace_label: "slow",
      pitch_var_label: "low"
    };
  }
  const avgRms =
    rmsValues.reduce((sum, value) => sum + value, 0) / rmsValues.length;
  const variance =
    rmsValues.reduce((sum, value) => sum + (value - avgRms) ** 2, 0) /
    rmsValues.length;
  const rmsStd = Math.sqrt(variance);
  const speechRatio =
    rmsValues.filter((value) => value > 0.02).length / rmsValues.length;
  const avgZcr =
    zcrValues.reduce((sum, value) => sum + value, 0) /
    Math.max(1, zcrValues.length);
  const energyLabel = avgRms > 0.08 ? "high" : avgRms > 0.04 ? "medium" : "low";
  const paceLabel =
    speechRatio > 0.7 ? "fast" : speechRatio > 0.4 ? "medium" : "slow";
  const pitchVarLabel = avgZcr > 0.12 ? "high" : avgZcr > 0.07 ? "medium" : "low";

  return {
    avg_rms: Number(avgRms.toFixed(4)),
    rms_std: Number(rmsStd.toFixed(4)),
    speech_ratio: Number(speechRatio.toFixed(3)),
    zcr: Number(avgZcr.toFixed(4)),
    energy_label: energyLabel,
    pace_label: paceLabel,
    pitch_var_label: pitchVarLabel
  };
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  retries = 1
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (retries > 0) {
      return fetchWithRetry(input, init, retries - 1);
    }
    throw error;
  }
}

export default function Home() {
  const [captureMode, setCaptureMode] = useState<"tab" | "mic">("tab");
  const [isRecording, setIsRecording] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [inferenceItems, setInferenceItems] = useState<InferenceItem[]>([]);
  const [verificationItems, setVerificationItems] = useState<
    VerificationResult[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [lastChunkInfo, setLastChunkInfo] = useState<string>("なし");
  const [liveUtterance, setLiveUtterance] = useState<string>("");
  const [relationship, setRelationship] = useState("不明");
  const [situationNote, setSituationNote] = useState("");
  const [inputLanguage, setInputLanguage] = useState<"auto" | "ja" | "en">(
    "auto"
  );
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; content: string }>
  >([]);
  const [toneSummary, setToneSummary] = useState({
    energy: "low",
    pace: "slow",
    pitch: "low"
  });
  const captureModeRef = useRef<"tab" | "mic">("tab");
  const relationshipRef = useRef<string>("不明");
  const situationNoteRef = useRef<string>("");
  const inputLanguageRef = useRef<"auto" | "ja" | "en">("auto");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const inferenceRef = useRef<InferenceItem[]>([]);
  const verificationRef = useRef<VerificationResult[]>([]);
  const chunkIndexRef = useRef(0);
  const chunkBufferRef = useRef<Blob[]>([]);
  const pendingChunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<number | null>(null);
  const recordingActiveRef = useRef(false);
  const emptyTranscriptCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const liveUtteranceRef = useRef<string>("");
  const liveDisplayRef = useRef<string>("");
  const liveUtteranceIdRef = useRef<string | null>(null);
  const liveStartAtRef = useRef<number | null>(null);
  const lastChunkAtRef = useRef<number>(0);
  const rmsHistoryRef = useRef<number[]>([]);
  const zcrHistoryRef = useRef<number[]>([]);
  const toneUpdateCounterRef = useRef(0);
  const inferenceMetaRef = useRef<
    Record<string, { lastAt: number; lastLabel: string; lastText: string }>
  >({});
  const inferenceQueueRef = useRef<
    Array<{
      utterance: string;
      targetId: string;
      createdAt: number;
      force: boolean;
      toneMetrics: {
        avg_rms: number;
        rms_std: number;
        speech_ratio: number;
        zcr: number;
        energy_label: string;
        pace_label: string;
        pitch_var_label: string;
      };
      recentContext: string[];
      sessionContext: string[];
    }>
  >([]);
  const inferenceQueueRunningRef = useRef(false);
  const inferenceQueueTimerRef = useRef<number | null>(null);
  const verifyQueueRef = useRef<
    Array<{
      utterance: string;
      targetId: string;
      createdAt: number;
      recentContext: string[];
      sessionContext: string[];
    }>
  >([]);
  const verifyQueueRunningRef = useRef(false);
  const verifyQueueTimerRef = useRef<number | null>(null);
  const verifyMetaRef = useRef<
    Record<string, { lastAt: number; lastText: string; lastSig: string }>
  >({});

  const isProcessing = processingCount > 0;
  const latestInference = inferenceItems[inferenceItems.length - 1];
  const latestVerification = verificationItems[verificationItems.length - 1];
  const temperature = latestInference?.temperature ?? 0;
  const latestTranscript = transcriptItems[transcriptItems.length - 1];
  const latestText =
    latestInference?.utterance ||
    liveUtterance ||
    latestTranscript?.text ||
    "";
  const latestIntentLabel = latestInference?.intent_label ?? "判断困難";
  const latestTone =
    INTENT_TONE_CLASSES[latestIntentLabel] || INTENT_TONE_CLASSES["判断困難"];
  const latestVerificationStatus =
    latestVerification?.status ?? "uncertain";
  const verificationMeta = VERIFY_STATUS_META[latestVerificationStatus];
  const latestExternalCheck = latestVerification?.external_check;
  const externalCheckMeta =
    EXTERNAL_VERDICT_META[latestExternalCheck?.verdict ?? "unavailable"];
  const canStart = situationNote.trim().length > 0;
  const assistantHints = [
    ...(latestVerification?.public_topics?.map((topic) => topic.topic) ?? []),
    ...(latestVerification?.suggested_queries ?? [])
  ].filter(Boolean);

  const updateTranscriptItems = (next: TranscriptItem[]) => {
    transcriptRef.current = next;
    setTranscriptItems(next);
  };

  const buildContextSnapshot = (timestamp: number) => {
    const previous = transcriptRef.current;
    const recentContext = previous
      .filter((item) => timestamp - item.timestamp <= CONTEXT_WINDOW_MS)
      .slice(-CONTEXT_MAX_ITEMS)
      .map((item) => item.text);
    const sessionContext = previous
      .slice(-SESSION_CONTEXT_MAX_ITEMS)
      .map((item) => item.text);
    return { recentContext, sessionContext };
  };

  const finalizeSentence = (
    sentence: string,
    timestamp: number,
    idOverride?: string | null
  ) => {
    const trimmed = sentence.trim();
    if (!trimmed) return null;
    const id = idOverride ?? crypto.randomUUID();
    const nextTranscript: TranscriptItem = {
      id,
      text: trimmed,
      timestamp
    };
    const updated = [...transcriptRef.current, nextTranscript].slice(
      -MAX_TRANSCRIPT_ITEMS
    );
    updateTranscriptItems(updated);
    return id;
  };

  const updateTranscriptText = (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const list = transcriptRef.current.slice();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return;
    if (list[index].text === trimmed) return;
    list[index] = { ...list[index], text: trimmed };
    updateTranscriptItems(list);
  };

  const updateInferenceItems = (next: InferenceItem[]) => {
    inferenceRef.current = next;
    setInferenceItems(next);
  };

  const updateVerificationItems = (next: VerificationResult[]) => {
    verificationRef.current = next;
    setVerificationItems(next);
  };

  const upsertVerificationItem = (item: VerificationResult) => {
    const list = verificationRef.current.slice();
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    updateVerificationItems(list.slice(-MAX_INFERENCE_ITEMS));
  };

  const upsertInferenceItem = (item: InferenceItem) => {
    const list = inferenceRef.current.slice();
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    updateInferenceItems(list.slice(-MAX_INFERENCE_ITEMS));
  };

  const finalizeLiveUtterance = (timestamp: number) => {
    const display = liveDisplayRef.current.trim();
    const raw = liveUtteranceRef.current.trim();
    const utterance = display || raw;
    if (!utterance) return;
    const id = finalizeSentence(utterance, timestamp, liveUtteranceIdRef.current);
    if (!id) return;
    liveUtteranceRef.current = "";
    liveDisplayRef.current = "";
    liveUtteranceIdRef.current = null;
    liveStartAtRef.current = null;
    setLiveUtterance("");
  };

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  useEffect(() => {
    relationshipRef.current = relationship;
  }, [relationship]);

  useEffect(() => {
    situationNoteRef.current = situationNote;
  }, [situationNote]);

  useEffect(() => {
    inputLanguageRef.current = inputLanguage;
  }, [inputLanguage]);

  const clearSession = () => {
    updateTranscriptItems([]);
    updateInferenceItems([]);
    updateVerificationItems([]);
    setErrorMessage(null);
    setLiveUtterance("");
    liveUtteranceRef.current = "";
    liveDisplayRef.current = "";
    liveUtteranceIdRef.current = null;
    liveStartAtRef.current = null;
    rmsHistoryRef.current = [];
    zcrHistoryRef.current = [];
    inferenceMetaRef.current = {};
    inferenceQueueRef.current = [];
    inferenceQueueRunningRef.current = false;
    if (inferenceQueueTimerRef.current !== null) {
      window.clearTimeout(inferenceQueueTimerRef.current);
      inferenceQueueTimerRef.current = null;
    }
    verifyMetaRef.current = {};
    verifyQueueRef.current = [];
    verifyQueueRunningRef.current = false;
    if (verifyQueueTimerRef.current !== null) {
      window.clearTimeout(verifyQueueTimerRef.current);
      verifyQueueTimerRef.current = null;
    }
    setAssistantMessages([]);
    setAssistantInput("");
  };

  const stopRecording = useCallback(() => {
    recordingActiveRef.current = false;
    if (chunkTimerRef.current !== null) {
      window.clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (inferenceQueueTimerRef.current !== null) {
      window.clearTimeout(inferenceQueueTimerRef.current);
      inferenceQueueTimerRef.current = null;
    }
    inferenceQueueRef.current = [];
    inferenceQueueRunningRef.current = false;
    if (verifyQueueTimerRef.current !== null) {
      window.clearTimeout(verifyQueueTimerRef.current);
      verifyQueueTimerRef.current = null;
    }
    verifyQueueRef.current = [];
    verifyQueueRunningRef.current = false;
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setInputLevel(0);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    pendingChunksRef.current = [];
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsRecording(false);
    setProcessingCount(0);
    setSessionId(null);
    finalizeLiveUtterance(Date.now());
  }, []);

  const sendAssistant = useCallback(async () => {
    const question = assistantInput.trim();
    if (!question || assistantLoading) return;
    const id = crypto.randomUUID();
    setAssistantMessages((prev) => [
      ...prev,
      { id, role: "user", content: question }
    ]);
    setAssistantInput("");
    setAssistantLoading(true);
    try {
      const sessionContext = transcriptRef.current
        .slice(-6)
        .map((item) => item.text);
      const latestUtterance =
        latestInference?.utterance ?? liveUtterance ?? "";
      const response = await fetchWithRetry("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversationContext: {
            relationship,
            situation: situationNote
          },
          latestUtterance,
          sessionContext,
          verificationTopics: latestVerification?.public_topics ?? [],
          suggestedQueries: latestVerification?.suggested_queries ?? [],
          externalCheck: latestVerification?.external_check
            ? {
                verdict: latestVerification.external_check.verdict,
                summary: latestVerification.external_check.summary,
                claim_checks: latestVerification.external_check.claim_checks,
                sources: latestVerification.external_check.sources.slice(0, 4)
              }
            : null
        })
      });
      const data = await response.json();
      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer.trim()
          : "外部での確認を推奨します。";
      setAssistantMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: answer }
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setAssistantLoading(false);
    }
  }, [
    assistantInput,
    assistantLoading,
    relationship,
    situationNote,
    latestInference,
    liveUtterance,
    latestVerification
  ]);

  const handleChunk = useCallback(
    async (blob: Blob, currentSessionId: string, chunkIndex: number) => {
      setProcessingCount((count) => count + 1);
      try {
        setLastChunkInfo(
          `${Math.round(blob.size / 1024)}KB / ${blob.type || "unknown"}`
        );
        const toneMetrics = computeToneMetrics(
          rmsHistoryRef.current,
          zcrHistoryRef.current
        );
        const isLikelySilence =
          toneMetrics.avg_rms < SILENCE_RMS_THRESHOLD &&
          toneMetrics.speech_ratio < SILENCE_SPEECH_RATIO_THRESHOLD;
        if (isLikelySilence) {
          emptyTranscriptCountRef.current += 1;
          if (
            liveUtteranceRef.current &&
            emptyTranscriptCountRef.current >= SILENCE_FINALIZE_CHUNKS
          ) {
            finalizeLiveUtterance(Date.now());
          }
          return;
        }
        const formData = new FormData();
        const mimeType = blob.type || "";
        let extension = "webm";
        if (mimeType.includes("mp4")) extension = "mp4";
        else if (mimeType.includes("mpeg")) extension = "mp3";
        else if (mimeType.includes("wav")) extension = "wav";
        formData.append("file", blob, `chunk-${chunkIndex}.${extension}`);
        formData.append("sessionId", currentSessionId);
        formData.append("chunkIndex", String(chunkIndex));
        if (inputLanguageRef.current !== "auto") {
          formData.append("language", inputLanguageRef.current);
        }

        const response = await fetchWithRetry("/api/transcribe", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          let message = "書き起こしに失敗しました";
          try {
            const errorPayload = await response.json();
            if (typeof errorPayload?.error === "string") {
              message = `${message} (${errorPayload.error})`;
            }
          } catch {
            // ignore parse errors
          }
          setErrorMessage(message);
          return;
        }

        const data = await response.json();
        const text = typeof data?.text === "string" ? data.text.trim() : "";
        if (!text) {
          emptyTranscriptCountRef.current += 1;
          if (
            liveUtteranceRef.current &&
            emptyTranscriptCountRef.current >= SILENCE_FINALIZE_CHUNKS
          ) {
            finalizeLiveUtterance(Date.now());
          } else if (emptyTranscriptCountRef.current >= 2) {
            const baseHint =
              captureModeRef.current === "tab"
                ? "書き起こしが空でした。共有ダイアログで音声共有をONにしてください"
                : "書き起こしが空でした。マイクの許可/入力音量を確認してください";
            const payloadKeys =
              Array.isArray(data?.meta?.payloadKeys) && data.meta.payloadKeys.length > 0
                ? ` (keys: ${data.meta.payloadKeys.join(",")})`
                : "";
            setErrorMessage(`${baseHint}${payloadKeys}`);
          }
          return;
        }
        const normalizedText = text.replace(/[\s\u3000]+/g, "");
        const isLowEnergy =
          toneMetrics.avg_rms < 0.04 && toneMetrics.speech_ratio < 0.35;
        if (
          isLowEnergy &&
          (SILENCE_PHRASES.has(normalizedText) || normalizedText.length <= 2)
        ) {
          emptyTranscriptCountRef.current += 1;
          if (
            liveUtteranceRef.current &&
            emptyTranscriptCountRef.current >= SILENCE_FINALIZE_CHUNKS
          ) {
            finalizeLiveUtterance(Date.now());
          }
          return;
        }
        emptyTranscriptCountRef.current = 0;

        setErrorMessage(null);

        const now = Date.now();
        const gapMs = now - (lastChunkAtRef.current || now);
        lastChunkAtRef.current = now;
        const englishLikeInput =
          inputLanguageRef.current === "en" ||
          (inputLanguageRef.current === "auto" && isEnglishLike(text));
        const mergedRaw = mergeUtterance(liveUtteranceRef.current, text);
        const merged = englishLikeInput ? mergedRaw : autoInsertCommas(mergedRaw);
        if (!merged || merged === liveUtteranceRef.current) {
          return;
        }

        liveUtteranceRef.current = merged;
        if (englishLikeInput) {
          const display = liveDisplayRef.current || "翻訳中...";
          setLiveUtterance(display);
        } else {
          liveDisplayRef.current = merged;
          setLiveUtterance(merged);
        }

        const { sentences, remainder } = splitSentences(merged);

        const runInference = async (
          utterance: string,
          targetId: string,
          createdAt: number,
          force: boolean,
          toneMetricsSnapshot: {
            avg_rms: number;
            rms_std: number;
            speech_ratio: number;
            zcr: number;
            energy_label: string;
            pace_label: string;
            pitch_var_label: string;
          },
          recentContext: string[],
          sessionContext: string[]
        ) => {
          const meta = inferenceMetaRef.current[targetId];
          if (meta) {
            const sameText = meta.lastText === utterance;
            const recent = createdAt - meta.lastAt < INFERENCE_REFRESH_MS;
            const delta =
              typeof meta.lastText === "string"
                ? Math.abs(utterance.length - meta.lastText.length)
                : 0;
            if (!force && sameText && meta.lastLabel === "判断困難") {
              return;
            }
            if (!force && sameText && recent) {
              return;
            }
            if (!force && recent && delta < INFERENCE_MIN_DELTA_CHARS) {
              return;
            }
          }

          const inferResponse = await fetchWithRetry("/api/infer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sessionId: currentSessionId,
              currentUtterance: utterance,
              recentContext,
              sessionContext,
              conversationContext: {
                relationship: relationshipRef.current,
                situation: situationNoteRef.current
              },
              toneFeatures: toneMetricsSnapshot
            })
          });

          if (!inferResponse.ok) {
            let message = "意図推定に失敗しました";
            try {
              const errorPayload = await inferResponse.json();
              if (typeof errorPayload?.error === "string") {
                message = `${message} (${errorPayload.error})`;
              }
            } catch {
              // ignore parse errors
            }
            setErrorMessage(message);
            return;
          }

          const inference = await inferResponse.json();
          if (typeof inference?.error === "string") {
            setErrorMessage(`意図推定に失敗しました (${inference.error})`);
          }
          const rawTemperature = inference.temperature;
          const temperatureValue: -2 | -1 | 0 | 1 | 2 =
            rawTemperature === 2 ||
            rawTemperature === 1 ||
            rawTemperature === 0 ||
            rawTemperature === -1 ||
            rawTemperature === -2
              ? rawTemperature
              : 0;
          const rawConfidence = inference.confidence;
          const confidenceValue =
            typeof rawConfidence === "number"
              ? Math.max(0, Math.min(1, rawConfidence))
              : 0;

          const correctedUtterance =
            typeof inference.utterance === "string" && inference.utterance.trim()
              ? inference.utterance.trim()
              : utterance;
          const englishLikeUtterance =
            inputLanguageRef.current === "en" ||
            (inputLanguageRef.current === "auto" && isEnglishLike(utterance));
          if (liveUtteranceIdRef.current === targetId) {
            liveDisplayRef.current = correctedUtterance;
            setLiveUtterance(correctedUtterance);
            if (!englishLikeUtterance) {
              liveUtteranceRef.current = correctedUtterance;
            }
          }
          updateTranscriptText(targetId, correctedUtterance);

          const nextInference: InferenceItem = {
            id: targetId,
            createdAt,
            utterance: correctedUtterance,
            intent_label: inference.intent_label ?? "判断困難",
            intent_note: inference.intent_note ?? "推定根拠が不足",
            temperature: temperatureValue,
            temperature_label: inference.temperature_label ?? "中立",
            confidence: confidenceValue
          };

          inferenceMetaRef.current[targetId] = {
            lastAt: createdAt,
            lastLabel: nextInference.intent_label,
            lastText: utterance
          };

          if (nextInference.intent_label === "判断困難") {
            return;
          }

          upsertInferenceItem(nextInference);
          setErrorMessage(null);
        };

        const enqueueInference = (
          utterance: string,
          targetId: string,
          createdAt: number,
          force: boolean,
          toneMetricsSnapshot: {
            avg_rms: number;
            rms_std: number;
            speech_ratio: number;
            zcr: number;
            energy_label: string;
            pace_label: string;
            pitch_var_label: string;
          },
          recentContext: string[],
          sessionContext: string[]
        ) => {
          const queue = inferenceQueueRef.current;
          const task = {
            utterance,
            targetId,
            createdAt,
            force,
            toneMetrics: toneMetricsSnapshot,
            recentContext,
            sessionContext
          };
          if (!force) {
            const existingIndex = queue.findIndex(
              (item) => item.targetId === targetId && !item.force
            );
            if (existingIndex >= 0) {
              queue[existingIndex] = task;
            } else {
              queue.push(task);
            }
          } else {
            queue.push(task);
          }
          if (!inferenceQueueRunningRef.current) {
            const pump = async () => {
              if (inferenceQueueRunningRef.current) return;
              const nextTask = inferenceQueueRef.current.shift();
              if (!nextTask) return;
              inferenceQueueRunningRef.current = true;
              await runInference(
                nextTask.utterance,
                nextTask.targetId,
                nextTask.createdAt,
                nextTask.force,
                nextTask.toneMetrics,
                nextTask.recentContext,
                nextTask.sessionContext
              );
              inferenceQueueRunningRef.current = false;
              if (inferenceQueueRef.current.length > 0) {
                const upcoming = inferenceQueueRef.current[0];
                const delay = computeQueueDelay(upcoming?.utterance ?? nextTask.utterance);
                inferenceQueueTimerRef.current = window.setTimeout(() => {
                  inferenceQueueTimerRef.current = null;
                  pump();
                }, delay);
              }
            };
            pump();
          }
        };

        const runVerify = async (
          utterance: string,
          targetId: string,
          createdAt: number,
          recentContext: string[],
          sessionContext: string[]
        ) => {
          const meta = verifyMetaRef.current[targetId];
          if (meta) {
            const sameText = meta.lastText === utterance;
            const recent = createdAt - meta.lastAt < VERIFY_COOLDOWN_MS;
            if (sameText && recent) {
              return;
            }
          }
          const verifyResponse = await fetchWithRetry("/api/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sessionId: currentSessionId,
              currentUtterance: utterance,
              sessionContext,
              conversationContext: {
                relationship: relationshipRef.current,
                situation: situationNoteRef.current
              }
            })
          });

          if (!verifyResponse.ok) {
            return;
          }
          const verifyPayload = await verifyResponse.json();
          if (!verifyPayload || verifyPayload.status === "out_of_scope") {
            return;
          }
          const result: VerificationResult = {
            id: targetId,
            createdAt,
            status: verifyPayload.status,
            summary: verifyPayload.summary ?? "要確認の可能性があります",
            public_topics: Array.isArray(verifyPayload.public_topics)
              ? verifyPayload.public_topics
              : [],
            suggested_queries: Array.isArray(verifyPayload.suggested_queries)
              ? verifyPayload.suggested_queries
              : [],
            excluded: Array.isArray(verifyPayload.excluded)
              ? verifyPayload.excluded
              : [],
            confidence:
              typeof verifyPayload.confidence === "number"
                ? verifyPayload.confidence
                : 0,
            basis_utterance: verifyPayload.basis_utterance ?? utterance,
            external_check:
              verifyPayload.external_check &&
              typeof verifyPayload.external_check === "object"
                ? verifyPayload.external_check
                : {
                    enabled: false,
                    verdict: "unavailable",
                    summary: "外部検索は未実行です。",
                    confidence: 0,
                    searched_queries: [],
                    sources: [],
                    claim_checks: []
                  }
          };

          const signature = JSON.stringify({
            status: result.status,
            summary: result.summary,
            topics: result.public_topics.map((topic) => topic.topic),
            queries: result.suggested_queries,
            externalVerdict: result.external_check.verdict,
            externalSummary: result.external_check.summary,
            externalSources: result.external_check.sources.map((source) => source.url)
          });
          if (meta && meta.lastSig === signature) {
            verifyMetaRef.current[targetId] = {
              lastAt: createdAt,
              lastText: utterance,
              lastSig: signature
            };
            return;
          }
          const globalKey = signature;
          if (verifyMetaRef.current["__latest__"]?.lastSig === globalKey) {
            return;
          }
          verifyMetaRef.current[targetId] = {
            lastAt: createdAt,
            lastText: utterance,
            lastSig: signature
          };
          verifyMetaRef.current["__latest__"] = {
            lastAt: createdAt,
            lastText: utterance,
            lastSig: signature
          };
          upsertVerificationItem(result);
        };

        const enqueueVerify = (
          utterance: string,
          targetId: string,
          createdAt: number,
          recentContext: string[],
          sessionContext: string[]
        ) => {
          if (utterance.trim().length < VERIFY_MIN_CHARS) return;
          const queue = verifyQueueRef.current;
          const task = { utterance, targetId, createdAt, recentContext, sessionContext };
          const existingIndex = queue.findIndex(
            (item) => item.targetId === targetId
          );
          if (existingIndex >= 0) {
            queue[existingIndex] = task;
          } else {
            queue.push(task);
          }
          if (!verifyQueueRunningRef.current) {
            const pump = async () => {
              if (verifyQueueRunningRef.current) return;
              const nextTask = verifyQueueRef.current.shift();
              if (!nextTask) return;
              verifyQueueRunningRef.current = true;
              await runVerify(
                nextTask.utterance,
                nextTask.targetId,
                nextTask.createdAt,
                nextTask.recentContext,
                nextTask.sessionContext
              );
              verifyQueueRunningRef.current = false;
              if (verifyQueueRef.current.length > 0) {
                verifyQueueTimerRef.current = window.setTimeout(() => {
                  verifyQueueTimerRef.current = null;
                  pump();
                }, VERIFY_QUEUE_GAP_MS);
              }
            };
            pump();
          }
        };

        for (const sentence of sentences) {
          const englishLikeSentence =
            inputLanguageRef.current === "en" ||
            (inputLanguageRef.current === "auto" && isEnglishLike(sentence));
          const displaySentence = englishLikeSentence ? "翻訳中..." : sentence;
          const id = finalizeSentence(displaySentence, now);
          if (id) {
            const contextSnapshot = buildContextSnapshot(now);
            enqueueInference(
              sentence,
              id,
              now,
              true,
              toneMetrics,
              contextSnapshot.recentContext,
              contextSnapshot.sessionContext
            );
            enqueueVerify(
              sentence,
              id,
              now,
              contextSnapshot.recentContext,
              contextSnapshot.sessionContext
            );
          }
        }

        let nextRemainder = remainder;
        if (nextRemainder && isLikelyFinal(text, merged, gapMs)) {
          const englishLikeRemainder =
            inputLanguageRef.current === "en" ||
            (inputLanguageRef.current === "auto" && isEnglishLike(nextRemainder));
          const displayRemainder = englishLikeRemainder
            ? "翻訳中..."
            : nextRemainder;
          const id = finalizeSentence(
            displayRemainder,
            now,
            liveUtteranceIdRef.current
          );
          if (id) {
            const contextSnapshot = buildContextSnapshot(now);
            enqueueInference(
              nextRemainder,
              id,
              now,
              true,
              toneMetrics,
              contextSnapshot.recentContext,
              contextSnapshot.sessionContext
            );
            enqueueVerify(
              nextRemainder,
              id,
              now,
              contextSnapshot.recentContext,
              contextSnapshot.sessionContext
            );
          }
          nextRemainder = "";
        }

        if (nextRemainder && liveStartAtRef.current) {
          const durationMs = now - liveStartAtRef.current;
          if (
            durationMs > LIVE_SOFT_SPLIT_MS &&
            nextRemainder.length > LIVE_SOFT_SPLIT_CHARS
          ) {
            const split = softSplitAtComma(nextRemainder);
            if (split) {
              const englishLikeSplit =
                inputLanguageRef.current === "en" ||
                (inputLanguageRef.current === "auto" && isEnglishLike(split.head));
              const displaySplit = englishLikeSplit ? "翻訳中..." : split.head;
              const id = finalizeSentence(displaySplit, now);
              if (id) {
                const contextSnapshot = buildContextSnapshot(now);
                enqueueInference(
                  split.head,
                  id,
                  now,
                  true,
                  toneMetrics,
                  contextSnapshot.recentContext,
                  contextSnapshot.sessionContext
                );
                enqueueVerify(
                  split.head,
                  id,
                  now,
                  contextSnapshot.recentContext,
                  contextSnapshot.sessionContext
                );
              }
              nextRemainder = split.tail;
              liveStartAtRef.current = now;
              liveUtteranceIdRef.current = null;
            }
          }
        }

        if (nextRemainder) {
          if (!liveUtteranceIdRef.current || sentences.length > 0) {
            liveUtteranceIdRef.current = crypto.randomUUID();
          }
          if (!liveStartAtRef.current || sentences.length > 0) {
            liveStartAtRef.current = now;
          }
          const englishLikeRemainder =
            inputLanguageRef.current === "en" ||
            (inputLanguageRef.current === "auto" && isEnglishLike(nextRemainder));
          liveUtteranceRef.current = nextRemainder;
          if (englishLikeRemainder) {
            const display = liveDisplayRef.current || "翻訳中...";
            setLiveUtterance(display);
          } else {
            liveDisplayRef.current = nextRemainder;
            setLiveUtterance(nextRemainder);
          }
          if (nextRemainder.length >= LIVE_MIN_INFER_CHARS) {
            const contextSnapshot = buildContextSnapshot(now);
            enqueueInference(
              nextRemainder,
              liveUtteranceIdRef.current,
              now,
              false,
              toneMetrics,
              contextSnapshot.recentContext,
              contextSnapshot.sessionContext
            );
          }
        } else {
          liveUtteranceRef.current = "";
          liveDisplayRef.current = "";
          liveUtteranceIdRef.current = null;
          liveStartAtRef.current = null;
          setLiveUtterance("");
        }
      } catch (error) {
        console.error(error);
        setErrorMessage("ネットワークエラーが発生しました");
      } finally {
        setProcessingCount((count) => Math.max(0, count - 1));
      }
    },
    []
  );

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setErrorMessage(null);

    try {
      if (!canStart) {
        setErrorMessage("状況メモを入力してください");
        return;
      }
      if (typeof MediaRecorder === "undefined") {
        setErrorMessage("このブラウザでは録音に対応していません");
        return;
      }
      const session = crypto.randomUUID();
      setSessionId(session);
      chunkIndexRef.current = 0;
      emptyTranscriptCountRef.current = 0;

      let stream: MediaStream;
      if (captureMode === "tab") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      if (!stream.getAudioTracks().length) {
        setErrorMessage("音声が検出できません");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      const audioStream = new MediaStream(stream.getAudioTracks());
      const audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.fftSize);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        let zeroCrossings = 0;
        let prev = (dataArray[0] - 128) / 128;
        for (let i = 0; i < dataArray.length; i += 1) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
          if (i > 0) {
            if ((value >= 0 && prev < 0) || (value < 0 && prev >= 0)) {
              zeroCrossings += 1;
            }
            prev = value;
          }
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setInputLevel(Math.min(1, rms * 2));
        const zcr = zeroCrossings / dataArray.length;
        rmsHistoryRef.current.push(rms);
        zcrHistoryRef.current.push(zcr);
        if (rmsHistoryRef.current.length > TONE_HISTORY_MAX) {
          rmsHistoryRef.current.shift();
        }
        if (zcrHistoryRef.current.length > TONE_HISTORY_MAX) {
          zcrHistoryRef.current.shift();
        }
        toneUpdateCounterRef.current += 1;
        if (toneUpdateCounterRef.current % 15 === 0) {
          const toneMetrics = computeToneMetrics(
            rmsHistoryRef.current,
            zcrHistoryRef.current
          );
          setToneSummary({
            energy: toneMetrics.energy_label,
            pace: toneMetrics.pace_label,
            pitch: toneMetrics.pitch_var_label
          });
        }
        levelRafRef.current = requestAnimationFrame(updateLevel);
      };
      levelRafRef.current = requestAnimationFrame(updateLevel);
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(
        audioStream,
        mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined
      );

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;
        chunkBufferRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setErrorMessage("録音エラーが発生しました");
      };

      recorder.onstop = () => {
        const blob =
          chunkBufferRef.current.length > 0
            ? new Blob(chunkBufferRef.current, {
                type: recorder.mimeType || "audio/webm"
              })
            : null;
        chunkBufferRef.current = [];
        if (blob && blob.size > 0) {
          pendingChunksRef.current.push(blob);
        }
        const shouldFlush =
          pendingChunksRef.current.length >= SEND_EVERY_CHUNKS ||
          !recordingActiveRef.current;
        if (shouldFlush && pendingChunksRef.current.length > 0) {
          const merged = new Blob(pendingChunksRef.current, {
            type: recorder.mimeType || "audio/webm"
          });
          pendingChunksRef.current = [];
          if (merged.size > 0) {
            const index = chunkIndexRef.current++;
            handleChunk(merged, session, index);
          }
        }
        if (recordingActiveRef.current) {
          recorder.start();
          chunkTimerRef.current = window.setTimeout(() => {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }, CHUNK_MS);
        }
      };

      mediaRecorderRef.current = recorder;
      recordingActiveRef.current = true;
      recorder.start();
      chunkTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, CHUNK_MS);
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      setErrorMessage("画面共有またはマイク許可が必要です");
    }
  }, [captureMode, handleChunk, isRecording, canStart]);

  const status = errorMessage
    ? "Error"
    : isRecording
    ? isProcessing
      ? "Processing"
      : "Recording"
    : "Idle";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Analysis Subtitle
          </p>
          <h1 className="text-2xl font-semibold">空気の裏字幕</h1>
          <p className="mt-1 text-sm text-slate-500">
            発話から読み取れる可能性を静かに可視化します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="pill">Status: {status}</span>
          <span className="pill">Session: {sessionId ? "Active" : "Idle"}</span>
        </div>
      </header>

      <section
        className={`panel border-l-4 ${latestTone.bg} ${latestTone.border} p-4`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${latestTone.text}`}>
              直前の評価
            </span>
            {liveUtterance && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-slate-500">
                暫定
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {latestInference
              ? `確信度 ${Math.round(latestInference.confidence * 100)}%`
              : "推定待機中"}
          </div>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-[1.6fr_0.8fr]">
          <div className="flex flex-col gap-3">
            <span className="text-[22px] font-semibold leading-snug text-slate-900">
              {latestInference?.intent_note ?? "推定待機中"}
            </span>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className={`font-semibold ${latestTone.text}`}>
                {latestInference?.intent_label ?? "判断困難"}
              </span>
              <span>温度感: {latestInference?.temperature_label ?? "中立"}</span>
              <span>
                {latestInference
                  ? `確信度 ${Math.round(latestInference.confidence * 100)}%`
                  : "推定待機中"}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-xs text-slate-500">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              直前の推論対象
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {latestText || "発話を待機中です。"}
            </div>
          </div>
        </div>
        <div className="mt-4 min-w-0 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0 flex-1 text-xs tracking-[0.2em] text-slate-400 leading-relaxed whitespace-normal break-words">
              検証アシスト
            </span>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${verificationMeta.border} ${verificationMeta.bg} ${verificationMeta.color}`}
              >
                {verificationMeta.label}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${externalCheckMeta.border} ${externalCheckMeta.bg} ${externalCheckMeta.color}`}
              >
                外部照合: {externalCheckMeta.label}
              </span>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-700">
            <span className="break-all leading-relaxed">
              {latestVerification?.summary ?? "検証待機中です。"}
            </span>
          </div>
          {latestVerification?.public_topics?.length ? (
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {latestVerification.public_topics.slice(0, 3).map((topic, index) => (
                <div key={`${topic.topic}-${index}`} className="break-all leading-relaxed">
                  ・{topic.topic}（{topic.reason}）
                </div>
              ))}
            </div>
          ) : null}
          {latestVerification?.suggested_queries?.length ? (
            <div className="mt-2 text-xs text-slate-500 break-all leading-relaxed">
              調べるワード:{" "}
              {latestVerification.suggested_queries.slice(0, 4).join(" / ")}
            </div>
          ) : null}
          {latestExternalCheck?.summary ? (
            <div className="mt-3 rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                外部照合サマリー
              </div>
              <div className="mt-1 break-all leading-relaxed">
                {latestExternalCheck.summary}
              </div>
            </div>
          ) : null}
          {latestExternalCheck?.claim_checks?.length ? (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              {latestExternalCheck.claim_checks.slice(0, 3).map((check, index) => {
                const meta = EXTERNAL_VERDICT_META[check.verdict];
                return (
                  <div
                    key={`${check.claim}-${index}`}
                    className="rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 break-all font-medium text-slate-700">
                        {check.claim}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.border} ${meta.bg} ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-1 break-all leading-relaxed">{check.reason}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {latestExternalCheck?.sources?.length ? (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                参照ソース
              </div>
              {latestExternalCheck.sources.slice(0, 3).map((source) => (
                <a
                  key={`${source.url}-${source.query}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 hover:border-slate-300"
                >
                  <div className="break-all font-medium text-slate-700">{source.title}</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {source.domain || source.query}
                    {source.published_date ? ` / ${source.published_date}` : ""}
                  </div>
                  <div className="mt-1 break-all leading-relaxed text-slate-500">
                    {source.snippet}
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <CaptureControls
          captureMode={captureMode}
          setCaptureMode={setCaptureMode}
          relationship={relationship}
          setRelationship={setRelationship}
          situationNote={situationNote}
          setSituationNote={setSituationNote}
          inputLanguage={inputLanguage}
          setInputLanguage={setInputLanguage}
          canStart={canStart}
          isRecording={isRecording}
          isProcessing={isProcessing}
          onStart={startRecording}
          onStop={stopRecording}
          onClear={clearSession}
        />
        <section className="panel flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="panel-title">検証質問ボット</h2>
            <span className="text-xs text-slate-400">
              検証アシストのトピックを元に相談できます
            </span>
          </div>
          {assistantHints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {assistantHints.slice(0, 6).map((hint) => (
                <button
                  key={hint}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
                  onClick={() => setAssistantInput(hint)}
                  type="button"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200/70 bg-white/70 p-3 text-sm text-slate-700">
            {assistantMessages.length === 0 && (
              <p className="text-xs text-slate-400">
                ここに質問を入力すると、状況メモと検証トピックを踏まえて回答します。
              </p>
            )}
            {assistantMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 ${
                  message.role === "assistant"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {message.role === "assistant" ? "Assistant" : "You"}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
              placeholder="例: Claude Codeのエージェントの要点は？"
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendAssistant();
                }
              }}
            />
            <button
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={sendAssistant}
              disabled={assistantLoading || assistantInput.trim().length === 0}
            >
              {assistantLoading ? "送信中" : "送信"}
            </button>
          </div>
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.8fr]">
        <TranscriptPanel items={transcriptItems} liveText={liveUtterance} />
        <IntentPanel items={inferenceItems} />
        <TemperatureMeter temperature={temperature} />
      </section>

      <footer className="flex flex-col gap-2 text-xs text-slate-500">
        <span>
          {isRecording
            ? "録音中。2秒ごとに文字起こしと推定を更新します。"
            : "Start で音声取得を開始してください。"}
        </span>
        <span>
          入力レベル: {Math.round(inputLevel * 100)}% / 直近チャンク:{" "}
          {lastChunkInfo}
        </span>
        <span>
          トーン目安: 声量 {toneSummary.energy} / 話速 {toneSummary.pace} / 揺れ{" "}
          {toneSummary.pitch}
        </span>
        {errorMessage && (
          <span className="text-danger">{errorMessage}</span>
        )}
      </footer>
    </main>
  );
}
