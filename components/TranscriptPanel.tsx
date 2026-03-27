import type { TranscriptItem } from "@/types/inference";

interface TranscriptPanelProps {
  items: TranscriptItem[];
  liveText?: string;
}

export default function TranscriptPanel({ items, liveText }: TranscriptPanelProps) {
  return (
    <div className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">通常字幕</h2>
        <span className="text-xs text-slate-400">最新ほど下に表示</span>
      </div>
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
    </div>
  );
}
