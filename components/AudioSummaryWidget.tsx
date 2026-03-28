import type { GeneratedReport, ReportSessionData } from "@/types/report";

interface AudioSummaryWidgetProps {
  reportSession: ReportSessionData;
  generatedReport: GeneratedReport | null;
  isGenerating: boolean;
  canGenerate: boolean;
  hasBlockingAnalysis: boolean;
  isStale: boolean;
  errorMessage: string | null;
  collapsed?: boolean;
  onGenerate: () => void;
  onToggleCollapsed?: () => void;
}

function formatDateTime(timestamp: number | null) {
  if (!timestamp) return "未開始";
  return new Date(timestamp).toLocaleString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "2-digit",
    day: "2-digit"
  });
}

export default function AudioSummaryWidget({
  reportSession,
  generatedReport,
  isGenerating,
  canGenerate,
  hasBlockingAnalysis,
  isStale,
  errorMessage,
  collapsed = false,
  onGenerate,
  onToggleCollapsed
}: AudioSummaryWidgetProps) {
  return (
    <section className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">音声要約</h2>
          <p className="mt-1 text-xs text-slate-500">
            取り込んだ音声全体が何について話していたかを簡潔にまとめます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            type="button"
          >
            {isGenerating ? "生成中" : "要約・検証更新"}
          </button>
          {onToggleCollapsed ? (
            <button
              aria-label={collapsed ? "音声要約を展開" : "音声要約を折りたたむ"}
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
      </div>
      {collapsed ? null : (
        <>
          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                対象開始
              </div>
              <div className="mt-1 font-medium text-slate-700">
                {formatDateTime(reportSession.firstStartAt)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                発話数
              </div>
              <div className="mt-1 font-medium text-slate-700">
                {reportSession.transcripts.length} 件
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                最終更新
              </div>
              <div className="mt-1 font-medium text-slate-700">
                {generatedReport ? formatDateTime(generatedReport.generatedAt) : "未生成"}
              </div>
            </div>
          </div>

          {hasBlockingAnalysis ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Stop直後は字幕や発話分析の後処理中です。完了後に生成してください。
            </div>
          ) : null}

          {generatedReport && isStale ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              その後にログが更新されています。必要なら再生成してください。
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
            {generatedReport ? (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {generatedReport.title}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-700">
                    {generatedReport.summaryOverview}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedReport.summaryTopics.length > 0 ? (
                    generatedReport.summaryTopics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">要点はまだ抽出されていません。</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                まだ音声要約は生成されていません。
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
