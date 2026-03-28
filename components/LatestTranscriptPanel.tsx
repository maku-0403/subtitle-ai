interface LatestTranscriptPanelProps {
  latestText: string;
  isLive: boolean;
}

export default function LatestTranscriptPanel({
  latestText,
  isLive
}: LatestTranscriptPanelProps) {
  return (
    <section className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title">リアルタイム字幕</h2>
        {isLive ? (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-slate-500">
            暫定
          </span>
        ) : null}
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          直前の分析対象
        </div>
        <div className="mt-3 text-[22px] font-medium leading-10 text-slate-800">
          {latestText || "発話を待機中です。"}
        </div>
      </div>
    </section>
  );
}
