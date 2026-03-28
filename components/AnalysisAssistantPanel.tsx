import type { AssistantMessage } from "@/types/popup";

interface AnalysisAssistantPanelProps {
  assistantHints: string[];
  assistantInput: string;
  assistantLoading: boolean;
  assistantMessages: AssistantMessage[];
  collapsed?: boolean;
  onAssistantInputChange: (value: string) => void;
  onSelectHint: (value: string) => void;
  onSubmit: () => void;
  onToggleCollapsed?: () => void;
}

export default function AnalysisAssistantPanel({
  assistantHints,
  assistantInput,
  assistantLoading,
  assistantMessages,
  collapsed = false,
  onAssistantInputChange,
  onSelectHint,
  onSubmit,
  onToggleCollapsed
}: AnalysisAssistantPanelProps) {
  return (
    <section className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="panel-title">分析アシスタント</h2>
          <p className="mt-1 text-xs text-slate-400">
            要約や検証トピックを元に追加質問できます
          </p>
        </div>
        {onToggleCollapsed ? (
          <button
            aria-label={collapsed ? "分析アシスタントを展開" : "分析アシスタントを折りたたむ"}
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

      {collapsed ? null : (
        <>
          {assistantHints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {assistantHints.slice(0, 6).map((hint) => (
                <button
                  key={hint}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
                  onClick={() => onSelectHint(hint)}
                  type="button"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 p-3">
            <div className="h-full space-y-2 overflow-y-auto pr-1 text-sm text-slate-700">
              {assistantMessages.length === 0 && (
                <p className="text-xs text-slate-400">
                  ここに質問を入力すると、分析メモと検証トピックを踏まえて回答します。
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
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700"
              placeholder="例: この主張の確認ポイントは？"
              value={assistantInput}
              onChange={(event) => onAssistantInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
            <button
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSubmit}
              disabled={assistantLoading || assistantInput.trim().length === 0}
              type="button"
            >
              {assistantLoading ? "送信中" : "送信"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
