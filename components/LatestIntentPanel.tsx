import type { InferenceItem } from "@/types/inference";

interface LatestIntentPanelProps {
  latestInference: InferenceItem | undefined;
  isLive: boolean;
}

const INTENT_TONE_CLASSES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  主張: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700" },
  説明: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  注意喚起: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  "意見・宣伝": { bg: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-700" },
  "確認・保留": { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  情報不足: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  判断困難: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500" }
};

export default function LatestIntentPanel({
  latestInference,
  isLive
}: LatestIntentPanelProps) {
  const latestIntentLabel = latestInference?.intent_label ?? "判断困難";
  const latestTone =
    INTENT_TONE_CLASSES[latestIntentLabel] || INTENT_TONE_CLASSES["判断困難"];

  return (
    <section
      className={`panel flex h-full flex-col gap-4 border-l-4 ${latestTone.bg} ${latestTone.border} p-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${latestTone.text}`}>
          直前の分析
        </span>
        {isLive ? (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-slate-500">
            暫定
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-[22px] font-semibold leading-snug text-slate-900">
          {latestInference?.intent_note ?? "分析待機中"}
        </span>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className={`font-semibold ${latestTone.text}`}>
            {latestInference?.intent_label ?? "判断困難"}
          </span>
          <span>伝え方: {latestInference?.temperature_label ?? "中立"}</span>
        </div>
      </div>
    </section>
  );
}
