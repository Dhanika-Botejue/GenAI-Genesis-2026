import { priorityMeta, signalLegend } from '../data/hospitalData';

export function Legend() {
  return (
    <div className="rounded-[26px] border border-white/80 bg-white/80 px-4 py-4 shadow-lg backdrop-blur xl:max-w-[720px]">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Room Priority
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(priorityMeta).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: value.fill }}
                />
                {value.label}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Body Signal Colors
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {signalLegend.map((signal) => (
              <div
                key={signal.label}
                className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <span className="relative flex h-3 w-3 items-center justify-center">
                  <span
                    className="absolute h-3 w-3 rounded-full opacity-30"
                    style={{ backgroundColor: signal.color }}
                  />
                  <span
                    className="absolute h-2 w-2 rounded-full border"
                    style={{ borderColor: signal.color }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: signal.color }}
                  />
                </span>
                {signal.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
