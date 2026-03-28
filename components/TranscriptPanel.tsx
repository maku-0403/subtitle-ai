import type { TranscriptItem } from "@/types/inference";

interface TranscriptPanelProps {
  items: TranscriptItem[];
  liveText?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function TranscriptPanel({
  items,
  liveText,
  collapsed = false,
  onToggleCollapsed
}: TranscriptPanelProps) {
  return (
    <div className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">通常字幕</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">最新ほど下に表示</span>
          {onToggleCollapsed ? (
            <button
              aria-label={collapsed ? "通常字幕を展開" : "通常字幕を折りたたむ"}
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
        <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {liveText && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-sm shadow-sm">
            <div className="text-xs text-blue-500">話途中</div>
            <div className="mt-1 text-sm text-slate-800">{liveText}</div>
          </div>
        )}
        {items.length === 0 && (
          <p className="text-sm text-slate-400">まだ字幕はありません。</p>
        )}
        {items.map((item, index) => {
          const isLatest = index === items.length - 1;
          return (
            <div
              key={item.id}
              className={`rounded-xl border px-3 py-2 text-sm shadow-sm transition ${
                isLatest
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              <div className="text-xs text-slate-400">
                {new Date(item.timestamp).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </div>
              <div className="mt-1 text-sm text-slate-800">{item.text}</div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
