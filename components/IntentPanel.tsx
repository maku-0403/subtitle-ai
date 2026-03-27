import type { InferenceItem } from "@/types/inference";

interface IntentPanelProps {
  items: InferenceItem[];
}

export default function IntentPanel({ items }: IntentPanelProps) {
  return (
    <div className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">発話分析</h2>
        <span className="text-xs text-slate-400">発話ごとの役割推定</span>
      </div>
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
    </div>
  );
}
