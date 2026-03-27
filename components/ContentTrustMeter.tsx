interface ContentTrustMeterProps {
  score: number | null;
  label: string;
  summary: string;
}

function scoreToWidth(score: number | null) {
  if (score === null) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreTone(score: number | null) {
  if (score === null) {
    return {
      bar: "bg-slate-300",
      badge: "border-slate-200 bg-slate-50 text-slate-500"
    };
  }
  if (score >= 75) {
    return {
      bar: "bg-emerald-400",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }
  if (score >= 55) {
    return {
      bar: "bg-sky-400",
      badge: "border-sky-200 bg-sky-50 text-sky-700"
    };
  }
  if (score >= 35) {
    return {
      bar: "bg-amber-400",
      badge: "border-amber-200 bg-amber-50 text-amber-700"
    };
  }
  return {
    bar: "bg-rose-400",
    badge: "border-rose-200 bg-rose-50 text-rose-700"
  };
}

export default function ContentTrustMeter({
  score,
  label,
  summary
}: ContentTrustMeterProps) {
  const tone = scoreTone(score);

  return (
    <div className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">コンテンツ信頼度</h2>
        <span className="text-xs text-slate-400">検証ベース</span>
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}
          >
            {label}
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {score === null ? "--" : `${Math.round(score)} / 100`}
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${tone.bar}`}
            style={{ width: `${scoreToWidth(score)}%` }}
          />
        </div>
        <div className="mt-4 text-sm leading-6 text-slate-600">{summary}</div>
      </div>
    </div>
  );
}
