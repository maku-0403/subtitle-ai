import type { Dispatch, SetStateAction } from "react";

interface CaptureControlsProps {
  captureMode: "tab" | "mic";
  setCaptureMode: Dispatch<SetStateAction<"tab" | "mic">>;
  relationship: string;
  setRelationship: Dispatch<SetStateAction<string>>;
  situationNote: string;
  setSituationNote: Dispatch<SetStateAction<string>>;
  inputLanguage: "auto" | "ja" | "en";
  setInputLanguage: Dispatch<SetStateAction<"auto" | "ja" | "en">>;
  canStart: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

export default function CaptureControls({
  captureMode,
  setCaptureMode,
  relationship,
  setRelationship,
  situationNote,
  setSituationNote,
  inputLanguage,
  setInputLanguage,
  canStart,
  isRecording,
  isProcessing,
  onStart,
  onStop,
  onClear
}: CaptureControlsProps) {
  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="panel-title">相手との関係</span>
          <select
            className="min-w-[180px] rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            disabled={isRecording}
          >
            <option value="不明">不明</option>
            <option value="友達">友達</option>
            <option value="同僚">同僚</option>
            <option value="面接官">面接官</option>
            <option value="取引先">取引先</option>
            <option value="顧客">顧客</option>
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
            状況メモ <span className="text-rose-500">*</span>
          </span>
          <textarea
            className="min-h-[240px] w-full resize-none rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
            placeholder="例: 最終面接の序盤。裏の意図が含まれる可能性が高い。"
            value={situationNote}
            onChange={(event) => setSituationNote(event.target.value)}
            disabled={isRecording}
          />
          {!canStart && (
            <p className="text-xs text-rose-500">
              状況メモを入力してください
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
        >
          Clear
        </button>
        <span className="text-xs text-slate-500">
          {isProcessing ? "処理中" : "待機中"}
        </span>
      </div>
    </div>
  );
}
