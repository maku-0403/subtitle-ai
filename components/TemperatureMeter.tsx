import type { TemperatureValue } from "@/types/inference";

const LEVELS: TemperatureValue[] = [2, 1, 0, -1, -2];

const LABELS: Record<string, string> = {
  2: "高",
  1: "やや高",
  0: "中立",
  "-1": "やや低",
  "-2": "低"
};

interface TemperatureMeterProps {
  temperature: TemperatureValue;
}

export default function TemperatureMeter({ temperature }: TemperatureMeterProps) {
  return (
    <div className="panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">温度感</h2>
        <span className="text-xs text-slate-400">5段階</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-between gap-4">
        <div className="flex w-full flex-col gap-2">
          {LEVELS.map((level) => {
            const isActive = level === temperature;
            return (
              <div key={level} className="flex items-center gap-3">
                <div
                  className={`h-6 flex-1 rounded-full border transition ${
                    isActive
                      ? "border-amber-200 bg-amber-300"
                      : "border-slate-200 bg-slate-100"
                  }`}
                />
                <span
                  className={`w-16 text-xs font-medium ${
                    isActive ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {LABELS[level]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
          現在: {LABELS[temperature]}
        </div>
      </div>
    </div>
  );
}
