import type { Dispatch, SetStateAction } from "react";

interface CaptureControlsProps {
  captureMode: "tab" | "mic";
  setCaptureMode: Dispatch<SetStateAction<"tab" | "mic">>;
  contentType: string;
  setContentType: Dispatch<SetStateAction<string>>;
  analysisNote: string;
  setAnalysisNote: Dispatch<SetStateAction<string>>;
  inputLanguage: "auto" | "ja" | "en";
  setInputLanguage: Dispatch<SetStateAction<"auto" | "ja" | "en">>;
  canStart: boolean;
  canClear: boolean;
  canGenerateReport: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isGeneratingReport: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onGenerateReport: () => void;
}

export default function CaptureControls({
  captureMode,
  setCaptureMode,
  contentType,
  setContentType,
  analysisNote,
  setAnalysisNote,
  inputLanguage,
  setInputLanguage,
  canStart,
  canClear,
  canGenerateReport,
  isRecording,
  isProcessing,
  isGeneratingReport,
  onStart,
  onStop,
  onClear,
  onGenerateReport
}: CaptureControlsProps) {
  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="panel-title">コンテンツ種別</span>
          <select
            className="min-w-[220px] rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
            disabled={isRecording}
          >
            <option value="YouTube動画">YouTube動画</option>
            <option value="オンライン会議">オンライン会議</option>
            <option value="セミナー・講習">セミナー・講習</option>
            <option value="商談・面接">商談・面接</option>
            <option value="雑談・会話">雑談・会話</option>
            <option value="その他">その他</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="panel-title">入力言語</span>
          <select
            className="min-w-[150px] rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
            value={inputLanguage}
            onChange={(event) =>
              setInputLanguage(event.target.value as "auto" | "ja" | "en")
            }
            disabled={isRecording}
          >
            <option value="auto">自動</option>
            <option value="ja">日本語</option>
            <option value="en">英語</option>
          </select>
        </div>
        <div className="space-y-2">
          <span className="panel-title">
            分析メモ <span className="text-rose-500">*</span>
          </span>
          <textarea
            className="min-h-[240px] w-full resize-none rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
            placeholder="例: 動画の要点整理と事実確認をしたい。講習の重要ポイントと怪しい主張を見たい。"
            value={analysisNote}
            onChange={(event) => setAnalysisNote(event.target.value)}
            disabled={isRecording}
          />
          {!canStart && (
            <p className="text-xs text-rose-500">
              分析メモを入力してください
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="panel-title">音声取得方法</span>
        <label className="pill">
          <input
            type="radio"
            name="captureMode"
            value="tab"
            checked={captureMode === "tab"}
            onChange={() => setCaptureMode("tab")}
            disabled={isRecording}
          />
          タブ音声
        </label>
        <label className="pill">
          <input
            type="radio"
            name="captureMode"
            value="mic"
            checked={captureMode === "mic"}
            onChange={() => setCaptureMode("mic")}
            disabled={isRecording}
          />
          マイク入力
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onStart}
          disabled={isRecording || !canStart}
        >
          Start
        </button>
        <button
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onStop}
          disabled={!isRecording}
        >
          Stop
        </button>
        <button
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={onClear}
          disabled={!canClear}
        >
          Clear
        </button>
        <button
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onGenerateReport}
          disabled={!canGenerateReport || isGeneratingReport}
        >
          {isGeneratingReport ? "レポート生成中" : "レポート生成"}
        </button>
        <span className="text-xs text-slate-500">
          {isProcessing ? "処理中" : "待機中"}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        要約・検証対象は Clear 後の最初の Start からです。
      </p>
    </div>
  );
}
