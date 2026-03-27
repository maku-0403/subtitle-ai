import type { GeneratedReport, ReportClaimItem } from "@/types/report";

interface ReportPanelProps {
  generatedReport: GeneratedReport | null;
  canDownloadLogs: boolean;
  hasPendingVerification: boolean;
  onDownloadReport: () => void;
  onDownloadLogs: () => void;
}

function ClaimList({
  title,
  emptyLabel,
  accentClass,
  items
}: {
  title: string;
  emptyLabel: string;
  accentClass: string;
  items: ReportClaimItem[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
      <div className={`text-sm font-semibold ${accentClass}`}>{title}</div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.claim}-${index}`}
              className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3"
            >
              <div className="text-sm font-medium text-slate-800">{item.claim}</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">{item.note}</div>
              {item.sources.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {item.sources.map((source) => (
                    <a
                      key={`${source.url}-${source.title}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-slate-200/70 bg-white px-3 py-2 hover:border-slate-300"
                    >
                      <div className="text-sm font-medium text-slate-700">
                        {source.title}
                      </div>
                      {source.note ? (
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          {source.note}
                        </div>
                      ) : null}
                      <div className="mt-2 text-xs font-medium text-slate-400">
                        ソースを開く
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportPanel({
  generatedReport,
  canDownloadLogs,
  hasPendingVerification,
  onDownloadReport,
  onDownloadLogs
}: ReportPanelProps) {
  return (
    <section className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">検証レポート</h2>
          <p className="mt-1 text-xs text-slate-500">
            疑うべき点、肯定材料、否定材料だけを整理して表示します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onDownloadReport}
            disabled={!generatedReport}
            type="button"
          >
            レポート保存
          </button>
          <button
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onDownloadLogs}
            disabled={!canDownloadLogs}
            type="button"
          >
            ログ保存
          </button>
        </div>
      </div>

      {hasPendingVerification ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
          新しい検証結果が追加される可能性があります。必要なら要約・検証更新を実行してください。
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        検証ソースは関連度で絞り込んでいますが、判断前に都度リンク先を確認してください。
      </div>

      {generatedReport ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ClaimList
            title="疑うべき点"
            emptyLabel="現時点で大きな疑義は抽出されていません。"
            accentClass="text-amber-700"
            items={generatedReport.cautionPoints}
          />
          <ClaimList
            title="肯定"
            emptyLabel="肯定寄りに確認できた材料はまだありません。"
            accentClass="text-emerald-700"
            items={generatedReport.supportingPoints}
          />
          <ClaimList
            title="否定"
            emptyLabel="否定寄りに確認できた材料はまだありません。"
            accentClass="text-rose-700"
            items={generatedReport.contradictingPoints}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
          <p className="text-sm text-slate-400">
            まだ検証レポートは生成されていません。
          </p>
        </div>
      )}
    </section>
  );
}
