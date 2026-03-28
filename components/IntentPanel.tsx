import type { InferenceItem } from "@/types/inference";

interface IntentPanelProps {
  items: InferenceItem[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function IntentPanel({
  items,
  collapsed = false,
  onToggleCollapsed
}: IntentPanelProps) {
  return (
    <div className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">発話分析</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">発話ごとの役割推定</span>
          {onToggleCollapsed ? (
            <button
              aria-label={collapsed ? "発話分析を展開" : "発話分析を折りたたむ"}
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
        {items.length === 0 && (
          <p className="text-sm text-slate-400">分析結果が表示されます。</p>
        )}
        {items.map((item, index) => {
          const isLatest = index === items.length - 1;
          return (
            <div
              key={item.id}
              className={`rounded-xl border px-3 py-3 text-sm shadow-sm transition ${
                isLatest
                  ? "border-blue-200 bg-blue-50/70"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {item.intent_label}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.intent_note}</p>
              <p className="mt-2 text-xs text-slate-400">{item.utterance}</p>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
