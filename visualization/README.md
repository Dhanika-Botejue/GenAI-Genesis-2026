# Elderly Care Spatial Monitoring

Standalone Vite + React + TypeScript front-end prototype for a hospital room visualization dashboard. This app is fully front-end only and uses local mock data for five rooms and five patients.

## Stack

- Vite
- React 19
- TypeScript
- Three.js
- React Three Fiber
- `@react-three/drei`
- Zustand
- Tailwind CSS

## Assumptions

- Node.js 20+ and npm 10+ are installed.
- The app lives in `visualization/` and does not modify the existing `frontend/` folder.
- No backend, API calls, authentication, or database are used.

## Bash setup

```bash
# optional repo-wide Python virtual environment
python -m venv .venv
source .venv/Scripts/activate

# run the front-end app
cd visualization
npm install
npm run dev
```

If you are on macOS/Linux instead of Git Bash on Windows:

```bash
source .venv/bin/activate
```

## Production build

```bash
cd visualization
npm run build
```

## Project structure

```text
visualization/
|- public/
|- src/
|  |- components/
|  |  |- FloorPlan.tsx
|  |  |- HospitalScene.tsx
|  |  |- InfoPanel.tsx
|  |  |- Legend.tsx
|  |  |- PatientModel.tsx
|  |  |- PriorityPulse.tsx
|  |  `- RoomMesh.tsx
|  |- data/
|  |  `- hospitalData.ts
|  |- store/
|  |  `- useHospitalStore.ts
|  |- App.tsx
|  |- index.css
|  `- main.tsx
|- index.html
|- package.json
|- postcss.config.cjs
|- tailwind.config.cjs
|- tsconfig.json
`- vite.config.ts
```

## Included features

- Simplified 3D elderly-care floor plan with five rooms and a nurse station
- Room priority zoning with translucent medical-dashboard color overlays
- Smooth camera focus when entering a room
- Primitive mannequin model ready to be swapped for a GLTF model later
- Clickable animated body-area condition pulses
- Zustand-driven room and condition selection
- Responsive right-side information panel and care legend
