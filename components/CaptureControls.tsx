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
  compactMode?: boolean;
  collapsed?: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onGenerateReport: () => void;
  onToggleCollapsed?: () => void;
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
  compactMode = false,
  collapsed = false,
  onStart,
  onStop,
  onClear,
  onGenerateReport,
  onToggleCollapsed
}: CaptureControlsProps) {
  if (compactMode) {
    return (
      <div className="panel flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="panel-title">コンテンツ設定</span>
            </div>
            {collapsed ? (
              <p className="mt-1 text-xs text-slate-500">
                種別、言語、入力方式、分析メモを確認できます。
              </p>
            ) : null}
          </div>
          {onToggleCollapsed ? (
            <button
              aria-label={collapsed ? "コンテンツ設定を展開" : "コンテンツ設定を折りたたむ"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              onClick={onToggleCollapsed}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                {collapsed ? (
                  <path d="M6 10l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M6 14l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          ) : null}
        </div>
        {!collapsed ? (
          <>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="pill">{contentType}</span>
              <span className="pill">
                言語: {inputLanguage === "auto" ? "自動" : inputLanguage.toUpperCase()}
              </span>
              <span className="pill">
                入力: {captureMode === "tab" ? "タブ音声" : "マイク入力"}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                分析メモ
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-700">
                {analysisNote || "分析メモを入力してください"}
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  }

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
