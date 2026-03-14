import { startTransition } from 'react';
import { allConditions, hospitalRooms, priorityMeta } from '../data/hospitalData';
import { useHospitalStore } from '../store/useHospitalStore';

export function InfoPanel() {
  const selectedRoom = useHospitalStore((state) => state.selectedRoom);
  const selectedCondition = useHospitalStore((state) => state.selectedCondition);
  const selectRoom = useHospitalStore((state) => state.selectRoom);
  const selectCondition = useHospitalStore((state) => state.selectCondition);
  const resetSelection = useHospitalStore((state) => state.resetSelection);

  const activeRoom = hospitalRooms.find((room) => room.id === selectedRoom) ?? null;
  const activeCondition =
    activeRoom?.patient.conditions.find((condition) => condition.id === selectedCondition) ?? null;

  return (
    <aside className="glass-card relative overflow-hidden rounded-[30px] px-5 py-5 sm:px-6">
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-sky-100/40" />
      <div className="relative z-10 flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Details Panel
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {activeRoom ? activeRoom.name : 'Unit Snapshot'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {activeRoom
                ? 'Room, patient, and condition details update live as you explore the 3D unit.'
                : 'Select a room on the floor plan to inspect a patient and zoom into their care space.'}
            </p>
          </div>

          {activeRoom ? (
            <button
              type="button"
              onClick={resetSelection}
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Reset view
            </button>
          ) : null}
        </div>

        {!activeRoom ? (
          <>
            <section className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Active Patients</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{hospitalRooms.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Priority Signals</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{allConditions.length}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Room roster</p>
                <p className="text-sm text-slate-500">Jump directly into any monitored room.</p>
              </div>

              <div className="mt-4 space-y-3">
                {hospitalRooms.map((room) => {
                  const meta = priorityMeta[room.priorityColor];

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        startTransition(() => selectRoom(room.id));
                      }}
                      className="w-full rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{room.name}</p>
                          <p className="mt-1 text-sm text-slate-600">{room.patient.name}</p>
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
                          style={{
                            backgroundColor: meta.soft,
                            color: meta.line,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1">
                          {room.occupancyStatus}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1">
                          {room.patient.conditions.length} signals
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Patient</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{activeRoom.patient.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Age {activeRoom.patient.age} | {activeRoom.occupancyStatus}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em]"
                  style={{
                    backgroundColor: priorityMeta[activeRoom.priorityColor].soft,
                    color: priorityMeta[activeRoom.priorityColor].line,
                  }}
                >
                  {priorityMeta[activeRoom.priorityColor].label}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">{activeRoom.patient.summary}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Room Status</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{activeRoom.occupancyStatus}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Signal Count</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {activeRoom.patient.conditions.length} active conditions
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Condition signals</p>
                <p className="text-sm text-slate-500">
                  Click a body pulse in the 3D view or use the list below to inspect that issue.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {activeRoom.patient.conditions.map((condition) => {
                  const isActive = activeCondition?.id === condition.id;

                  return (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => {
                        startTransition(() => selectCondition(isActive ? null : condition.id));
                      }}
                      className="w-full rounded-[22px] border bg-slate-50/75 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white"
                      style={{
                        borderColor: isActive ? condition.color : 'rgba(203, 213, 225, 0.8)',
                        boxShadow: isActive ? `0 12px 28px ${condition.color}22` : 'none',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{condition.label}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {condition.organ} | {condition.severity}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {condition.description}
                          </p>
                        </div>
                        <span
                          className="mt-1 h-3 w-3 rounded-full"
                          style={{ backgroundColor: condition.color }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
              {activeCondition ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Condition Focus</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {activeCondition.label}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {activeCondition.organ} | {activeCondition.severity}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em]"
                      style={{
                        backgroundColor: `${activeCondition.color}20`,
                        color: activeCondition.color,
                      }}
                    >
                      Monitoring active
                    </span>
                  </div>

                  <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Issue description</p>
                      <p className="mt-2">{activeCondition.description}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recommended support</p>
                      <p className="mt-2">{activeCondition.support}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Care plan</p>
                      <p className="mt-2">{activeCondition.carePlan}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Monitoring status</p>
                      <p className="mt-2">{activeCondition.monitoring}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/75 p-5 text-sm leading-6 text-slate-600">
                  Click one of the colored body indicators on {activeRoom.patient.name} to see the
                  issue description for that area, then review the full care notes and support
                  recommendations here.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
