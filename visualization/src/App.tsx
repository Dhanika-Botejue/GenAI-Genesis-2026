import { Suspense, lazy } from 'react';
import { hospitalRooms } from './data/hospitalData';
import { InfoPanel } from './components/InfoPanel';
import { Legend } from './components/Legend';

const urgentCount = hospitalRooms.filter((room) => room.priorityColor === 'red').length;
const monitoringCount = hospitalRooms.filter((room) => room.occupancyStatus !== 'Occupied').length;
const signalCount = hospitalRooms.reduce((total, room) => total + room.patient.conditions.length, 0);
const HospitalScene = lazy(async () => ({
  default: (await import('./components/HospitalScene')).HospitalScene,
}));

function App() {
  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
        <header className="glass-card relative overflow-hidden rounded-[30px] px-6 py-6 sm:px-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-700">
                Spatial Care Dashboard
              </p>
              <h1
                className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
                style={{ fontFamily: "'Aptos Display', 'Aptos', 'Segoe UI', sans-serif" }}
              >
                Elderly Care Spatial Monitoring
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Explore the care unit in 3D, focus on a room, and inspect patient-specific
                priority signals directly on the mannequin model.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <div className="rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Rooms Live</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{hospitalRooms.length}</p>
              </div>
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-rose-500">Urgent Zones</p>
                <p className="mt-2 text-2xl font-semibold text-rose-700">{urgentCount}</p>
              </div>
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-sky-600">Patient Signals</p>
                <p className="mt-2 text-2xl font-semibold text-sky-800">{signalCount}</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <Legend />
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                {monitoringCount} monitored rooms
              </span>
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5">
                Click a room to enter its care space
              </span>
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5">
                Click any pulse to inspect a condition
              </span>
            </div>
          </div>
        </header>

        <main className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="glass-card relative min-h-[540px] overflow-hidden rounded-[30px] p-3 sm:min-h-[680px]">
            <div className="absolute inset-0 bg-care-grid bg-[size:32px_32px] opacity-40" />
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/60 to-transparent" />
            <div className="absolute left-5 top-5 z-10 rounded-full border border-white/90 bg-white/80 px-4 py-2 text-xs font-medium tracking-wide text-slate-600 shadow-lg backdrop-blur">
              Interactive care-space floor plan
            </div>
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-6 py-5 text-center shadow-lg backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">
                      Loading Scene
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Preparing the care-space visualization.
                    </p>
                  </div>
                </div>
              }
            >
              <HospitalScene />
            </Suspense>
          </section>

          <InfoPanel />
        </main>
      </div>
    </div>
  );
}

export default App;
