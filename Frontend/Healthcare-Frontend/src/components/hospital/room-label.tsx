'use client';

import { Html } from '@react-three/drei';

export function RoomLabel({
  label,
  position,
  fontSize,
  color = '#304451',
}: {
  label: string;
  position: [number, number, number];
  fontSize: number;
  color?: string;
}) {
  return (
    <Html position={position} center distanceFactor={12} transform sprite>
      <div
        className="pointer-events-none whitespace-nowrap rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-center font-medium shadow-sm backdrop-blur"
        style={{
          color,
          fontSize: `${Math.max(fontSize * 12, 10)}px`,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </div>
    </Html>
  );
}
