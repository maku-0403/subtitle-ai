import type { VerificationResult } from "@/types/verification";

interface VerificationAssistantPanelProps {
  latestVerification: VerificationResult | null;
}

const VERIFY_STATUS_META = {
  needs_research: {
    label: "要確認",
    color: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50"
  },
  likely_ok: {
    label: "一致の可能性",
    color: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50"
  },
  uncertain: {
    label: "不明",
    color: "text-slate-600",
    border: "border-slate-200",
    bg: "bg-slate-50"
  },
  out_of_scope: {
    label: "対象外",
    color: "text-slate-500",
    border: "border-slate-200",
    bg: "bg-slate-50"
  }
} as const;

const EXTERNAL_VERDICT_META = {
  supported: {
    label: "根拠あり",
    color: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50"
  },
  contradicted: {
    label: "矛盾あり",
    color: "text-rose-700",
    border: "border-rose-200",
    bg: "bg-rose-50"
  },
  mixed: {
    label: "根拠混在",
    color: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50"
  },
  insufficient: {
    label: "根拠不足",
    color: "text-slate-600",
    border: "border-slate-200",
    bg: "bg-slate-50"
  },
  unavailable: {
    label: "未実行",
    color: "text-slate-500",
    border: "border-slate-200",
    bg: "bg-slate-50"
  }
} as const;

export default function VerificationAssistantPanel({
  latestVerification
}: VerificationAssistantPanelProps) {
  const verificationMeta =
    VERIFY_STATUS_META[latestVerification?.status ?? "uncertain"];
  const externalCheckMeta =
    EXTERNAL_VERDICT_META[latestVerification?.external_check?.verdict ?? "unavailable"];

  return (
    <section className="panel flex h-full flex-col gap-4 p-4">
      <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="min-w-0 flex-1 text-xs tracking-[0.2em] text-slate-400 leading-relaxed whitespace-normal break-words">
            検証アシスト
          </span>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${verificationMeta.border} ${verificationMeta.bg} ${verificationMeta.color}`}
            >
              {verificationMeta.label}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${externalCheckMeta.border} ${externalCheckMeta.bg} ${externalCheckMeta.color}`}
            >
              外部照合: {externalCheckMeta.label}
            </span>
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-700">
          <span className="break-all leading-relaxed">
            {latestVerification?.summary ?? "検証待機中です。"}
          </span>
        </div>
        {latestVerification?.public_topics?.length ? (
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {latestVerification.public_topics.slice(0, 3).map((topic, index) => (
              <div key={`${topic.topic}-${index}`} className="break-all leading-relaxed">
                ・{topic.topic}（{topic.reason}）
              </div>
            ))}
          </div>
        ) : null}
        {latestVerification?.suggested_queries?.length ? (
          <div className="mt-2 text-xs text-slate-500 break-all leading-relaxed">
            調べるワード:{" "}
            {latestVerification.suggested_queries.slice(0, 4).join(" / ")}
          </div>
        ) : null}
        {latestVerification?.external_check?.summary ? (
          <div className="mt-3 rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              外部照合サマリー
            </div>
            <div className="mt-1 break-all leading-relaxed">
              {latestVerification.external_check.summary}
            </div>
          </div>
        ) : null}
        {latestVerification?.external_check?.claim_checks?.length ? (
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            {latestVerification.external_check.claim_checks
              .slice(0, 3)
              .map((check, index) => {
                const meta = EXTERNAL_VERDICT_META[check.verdict];
                return (
                  <div
                    key={`${check.claim}-${index}`}
                    className="rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 break-all font-medium text-slate-700">
                        {check.claim}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.border} ${meta.bg} ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-1 break-all leading-relaxed">{check.reason}</div>
                  </div>
                );
              })}
          </div>
        ) : null}
        {latestVerification?.external_check?.sources?.length ? (
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              参照ソース
            </div>
            {latestVerification.external_check.sources.slice(0, 3).map((source) => (
              <a
                key={`${source.url}-${source.query}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 hover:border-slate-300"
              >
                <div className="break-all font-medium text-slate-700">{source.title}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {source.domain || source.query}
                  {source.published_date ? ` / ${source.published_date}` : ""}
                </div>
                <div className="mt-1 break-all leading-relaxed text-slate-500">
                  {source.snippet}
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
