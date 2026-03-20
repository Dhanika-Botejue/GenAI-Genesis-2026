'use client';

import { useState } from 'react';
import { DisclosureIcon } from '@/components/shared/disclosure-icon';

export function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className={`overflow-hidden border border-[var(--line)] shadow-[var(--shadow)] transition-[padding,border-radius,background-color] duration-200 ${
        open
          ? 'medical-panel mr-0 ml-auto w-[calc(100%-6rem)] self-end rounded-[28px] p-4'
          : 'mr-0 ml-auto w-[calc(100%-6rem)] self-end rounded-[24px] bg-[var(--panel-strong)] px-4 py-3'
      }`}
      style={{ isolation: 'isolate' }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Legend</h2>
        <DisclosureIcon open={open} className="text-slate-500" />
      </button>

      {open ? (
        <div className="mt-3 grid gap-2 text-sm text-slate-700">
          <LegendRow color="#79c68e" label="Low priority care room" />
          <LegendRow color="#e8ca57" label="Medium priority care room" />
          <LegendRow color="#e79653" label="High priority care room" />
          <LegendRow color="#df6e62" label="Critical priority care room" />
          <LegendRow color="#c9d3da" label="Non-care or uncertain room" />
        </div>
      ) : null}
    </section>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
