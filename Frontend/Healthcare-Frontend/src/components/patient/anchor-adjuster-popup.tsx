'use client';

import { useEffect, useMemo, useState } from 'react';
import { isNarrowViewport } from '@/lib/browser/viewport';
import { getBodyAnchor } from '@/lib/scene/body-anchors';
import { useAppStore } from '@/store/useAppStore';

const TEMPORARY_X_MIN = -5;
const TEMPORARY_X_MAX = 5;
const TEMPORARY_Y_MIN = -10;
const TEMPORARY_Y_MAX = 10;
const TEMPORARY_Z_MIN = -5;
const TEMPORARY_Z_MAX = 5;

export function AnchorAdjusterPopup() {
  const sceneMode = useAppStore((state) => state.sceneMode);
  const selectedAnchorId = useAppStore((state) => state.selectedAnchorId);
  const anchorOverrides = useAppStore((state) => state.anchorOverrides);
  const anchorEditMode = useAppStore((state) => state.debug.anchorEditMode);
  const popupPosition = useAppStore((state) => state.anchorEditorScreenPosition);
  const selectAnchor = useAppStore((state) => state.selectAnchor);
  const setAnchorOverride = useAppStore((state) => state.setAnchorOverride);
  const resetAnchorOverride = useAppStore((state) => state.resetAnchorOverride);
  const [narrow, setNarrow] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });

  useEffect(() => {
    const update = () => {
      setNarrow(isNarrowViewport(window.innerWidth));
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const anchor = useMemo(
    () => (selectedAnchorId ? getBodyAnchor(selectedAnchorId, anchorOverrides) : null),
    [anchorOverrides, selectedAnchorId],
  );

  if (sceneMode !== 'patient' || !anchorEditMode || !selectedAnchorId || !anchor || !popupPosition.visible) {
    return null;
  }

  const content = (
    <AnchorAdjusterBody
      anchorId={selectedAnchorId}
      label={anchor.label}
      x={anchor.position[0]}
      y={anchor.position[1]}
      z={anchor.position[2]}
      onClose={() => selectAnchor(null)}
      onReset={() => resetAnchorOverride(selectedAnchorId)}
      onChange={(payload) => setAnchorOverride(selectedAnchorId, payload)}
    />
  );

  if (narrow) {
    return (
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-40 rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-2xl">
        {content}
      </div>
    );
  }

  const left = Math.min(Math.max(popupPosition.x - 170, 20), viewport.width - 380);
  const top = Math.min(Math.max(popupPosition.y - 88, 90), viewport.height - 420);

  return (
    <div
      className="pointer-events-auto absolute z-40 w-[360px] rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-2xl"
      style={{ left, top, maxHeight: '50vh' }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {content}
    </div>
  );
}

function AnchorAdjusterBody({
  anchorId,
  label,
  x,
  y,
  z,
  onClose,
  onReset,
  onChange,
}: {
  anchorId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  onClose: () => void;
  onReset: () => void;
  onChange: (payload: { x?: number; y?: number; z?: number }) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Temporary Anchor Editor</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{label}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {anchorId} | full xyz adjustment
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-3 overflow-auto pr-1" style={{ maxHeight: 'calc(50vh - 5rem)' }}>
        <CoordinateCard x={x} y={y} z={z} />

        <SliderRow
          label="X"
          min={TEMPORARY_X_MIN}
          max={TEMPORARY_X_MAX}
          value={x}
          onChange={(value) => onChange({ x: value })}
        />

        <SliderRow
          label="Y"
          min={TEMPORARY_Y_MIN}
          max={TEMPORARY_Y_MAX}
          value={y}
          onChange={(value) => onChange({ y: value })}
        />

        <SliderRow
          label="Z"
          min={TEMPORARY_Z_MIN}
          max={TEMPORARY_Z_MAX}
          value={z}
          onChange={(value) => onChange({ z: value })}
        />

        <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Notes</p>
          <p className="mt-1 leading-6">
            Closing this panel keeps the coordinates in state. Use Z to move a marker toward or away from the front of the body.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Reset This Anchor
        </button>
      </div>
    </>
  );
}

function CoordinateCard({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm">
      <CoordinatePill label="X" value={x} />
      <CoordinatePill label="Y" value={y} />
      <CoordinatePill label="Z" value={z} />
    </div>
  );
}

function CoordinatePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2 text-center text-slate-700">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-1 font-medium">{value.toFixed(3)}</p>
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
        <input
          type="number"
          min={min}
          max={max}
          step={0.005}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (!Number.isFinite(nextValue)) {
              return;
            }
            onChange(nextValue);
          }}
          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-right text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.005}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-800"
      />
      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
        <span>{min.toFixed(2)}</span>
        <span>{max.toFixed(2)}</span>
      </div>
    </label>
  );
}
