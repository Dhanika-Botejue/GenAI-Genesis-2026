# Hospital Care Visualization

Next.js App Router prototype for:

- reconstructing a simplified hospital floor plan from a raster upload
- rendering that layout in a persistent Three.js scene
- opening a patient-detail view only for rooms that have live patient JSON

This README is intentionally written so both:

- a human developer
- an LLM generating integration code

can understand exactly how the app works and how to hook a backend into it.

## What changed

The app now uses only the lightweight local heuristic analysis path.

That means:

- you only need `npm run dev`
- no Python sidecar is required
- no Gemini setup is required
- floor-plan uploads are processed locally through the browser-side worker pipeline

The old rich analysis path is deprecated.

## Experience modes

The app now has a top-level mode toggle:

- `Nurse`
  - the existing 3D hospital floor-plan and patient-condition workflow

- `Doctor`
  - the integrated patient-calling dashboard adapted from the
    `GenAI-Genesis-2026` `twilio-and-elevenlabs` branch
  - includes patient CRUD, profile editing, call question authoring,
    live call polling, and call history

Important:

- `Doctor` mode expects the FastAPI backend from that shared repo to be running
- this frontend proxies Doctor requests through:
  - `app/api/doctor/[...path]/route.ts`

## Core concept

There are 2 separate data layers in this app:

1. Floor-plan geometry
   - created from the default layout or from raster upload analysis
   - controls where rooms appear in 3D
   - does not make rooms clickable on its own

2. Live room/patient JSON
   - sent separately to the live-data route
   - decides which rooms become active
   - decides which rooms get patient-specific colors and details
   - drives the patient-detail scene

Important rule:

- If a room is not associated with incoming live JSON, it stays grey and non-clickable.

## Current behavior

At startup:

- the app shows the default hospital layout
- care rooms are visible
- care rooms are grey and inactive by default

After floor-plan upload analysis:

- the hospital layout updates
- rooms are still inactive by default
- care rooms stay grey until live JSON is applied

After live room JSON is applied:

- only assigned rooms become clickable
- assigned rooms receive room/patient data
- unassigned rooms remain grey and inert

If only 2 room JSON objects are sent:

- only 2 rooms become clickable
- all other rooms stay inactive

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Three.js with `@react-three/fiber` and `@react-three/drei`
- Zustand

## Requirements

### Runtime requirements

- Node.js
- npm

### Input requirements

Floor-plan uploads:

- PNG or JPG only
- raster input only

Live room feed:

- JSON
- must contain a `rooms` array

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

That is enough to run the full current app.

## Environment

Copy `.env.example` to `.env`.

Current variables:

- `NEXT_PUBLIC_UPLOAD_MAX_MB`
  - client-side upload size validation

- `NEXT_PUBLIC_ANALYSIS_MAX_SIDE_PX`
  - maximum image dimension used in local heuristic analysis

- `DOCTOR_API_BASE_URL`
  - backend base URL for the integrated Doctor workspace
  - defaults to `http://127.0.0.1:5000`

No Python or Gemini environment variables are required for the current path.

## Vercel + Vultr deployment

For production, deploy the frontend and backend separately:

- Vercel hosts this Next.js app.
- Vultr hosts the FastAPI backend from `Backend/GenAI-Genesis-2026`.

Use this wiring:

1. Set `DOCTOR_API_BASE_URL` in Vercel to your public Vultr backend origin.
  - Example: `https://api.your-domain.com`
2. Keep frontend Doctor calls pointed at `/api/doctor/*`.
  - The browser talks only to Vercel.
  - The Vercel route handler proxies requests server-side to Vultr.
3. Do not point `DOCTOR_API_BASE_URL` at the frontend URL.
  - It must target the backend origin.
4. Prefer HTTPS on the Vultr side.
  - Twilio and production browsers should not depend on plain HTTP.

Why this avoids cross-origin issues:

- the browser never calls Vultr directly for Doctor mode
- Vercel calls Vultr from the server side
- that means no browser CORS requirement for the Doctor dashboard path

## High-level architecture

### Persistent 3D scene

The app uses one persistent React Three Fiber canvas.

Modes:

- hospital overview mode
- patient detail mode

The canvas stays mounted while content changes.

### Data routes

There are 2 relevant API routes now:

1. `POST /api/analyze-floorplan`
   - deprecated
   - no longer used by the frontend upload flow
   - returns a deprecation response

2. `GET /api/live-room-data`
   - returns the example live-data template and allowed values

3. `POST /api/live-room-data`
   - receives room/patient JSON
   - maps it onto arbitrary available room slots
   - returns:
     - updated floorplan
     - normalized patient records
     - assigned room IDs
     - unassigned room IDs

### Actual upload path now

The upload flow does this:

1. user selects PNG/JPG
2. frontend validates file
3. frontend runs the lightweight browser worker pipeline
4. frontend receives a parsed floorplan
5. frontend shows that floorplan
6. rooms remain inactive until live JSON is applied

## Actual live-data flow

The app expects live JSON to be applied after the floorplan exists.

Typical flow:

1. load or analyze a floorplan
2. POST live room/patient JSON to `/api/live-room-data`
3. apply the returned payload to the frontend store
4. only assigned rooms become clickable

## Most important integration rule

`POST /api/live-room-data` is stateless.

That means:

- if you omit `baseFloorplan`, the route falls back to the built-in default layout
- if you want live JSON applied to the currently loaded analyzed layout, you must provide `baseFloorplan`

If you use the provided frontend helper:

- `syncLiveRoomFeedToStore(...)`

then this is handled automatically, because it injects the current floorplan from Zustand.

## Live room-data routes

### `GET /api/live-room-data`

Purpose:

- fetch the canonical example template
- fetch allowed enum values
- fetch defaulting rules

Example:

```bash
curl http://localhost:3000/api/live-room-data
```

### `POST /api/live-room-data`

Purpose:

- receive room/patient JSON
- normalize missing fields
- assign payloads to available room slots
- return a floorplan where only matched rooms are active

Example:

```bash
curl -X POST http://localhost:3000/api/live-room-data \
  -H "Content-Type: application/json" \
  -d @public/examples/live-room-data.template.json
```

## Live JSON contract

### Top-level request shape

```json
{
  "rooms": [
    {
      "roomExternalId": "WARD-A-101",
      "roomName": "Room A-101",
      "roomLabel": "A-101",
      "parsedLabel": "Room A-101",
      "roomType": "care",
      "priority": "high",
      "occupancyStatus": "occupied",
      "confidence": 1,
      "displayColor": "#e79653",
      "patient": {
        "id": "PT-2048",
        "displayId": "PT-2048",
        "age": 82,
        "summary": "High-support patient record with two active monitored issues.",
        "conditions": [
          {
            "id": "PT-2048-heart-1",
            "label": "Cardiac rhythm review",
            "bodyArea": "heart",
            "severity": "high",
            "color": "#e79653",
            "shortDescription": "Short irregular rhythm episodes noted during transfer windows.",
            "detailedNotes": "Keep transfer strain low and document symptom timing with any rhythm irregularity reports.",
            "monitoring": "Telemetry review every 30 to 60 minutes.",
            "recommendedSupport": "Head-elevated rest and assisted low-exertion transfers."
          }
        ]
      }
    }
  ],
  "baseFloorplan": {
    "...": "optional current parsed floorplan object"
  }
}
```

### Minimum valid payload

```json
{
  "rooms": []
}
```

That is valid, but it activates no rooms.

## Allowed values

### Room-level

- `priority`
  - `none`
  - `low`
  - `medium`
  - `high`
  - `critical`

- `roomType`
  - `care`
  - `nonCare`
  - `unknown`

- `occupancyStatus`
  - `occupied`
  - `vacant`
  - `observation`
  - `unknown`

### Condition-level

- `severity`
  - `low`
  - `medium`
  - `high`
  - `critical`

- `bodyArea`
  - `head`
  - `chest`
  - `heart`
  - `lungs`
  - `liver`
  - `abdomen`
  - `leftArm`
  - `rightArm`
  - `leftLeg`
  - `rightLeg`

## Defaulting behavior

If a field is omitted, the normalizer applies safe defaults.

### String defaults

These default to `""`:

- `roomExternalId`
- `roomName`
- `roomLabel`
- `parsedLabel`
- `displayColor`
- `patient.id`
- `patient.displayId`
- `patient.summary`
- `condition.id`
- `condition.label`
- `condition.shortDescription`
- `condition.detailedNotes`
- `condition.monitoring`
- `condition.recommendedSupport`

### Room defaults

- missing `priority` -> `none`
- missing `roomType` -> `care`
- missing `occupancyStatus` -> `unknown`
- missing `confidence` -> `1`
- missing `displayColor` -> grey when needed

### Patient defaults

- missing `age` -> `0`
- missing `displayId` -> derived from `patient.id`
- missing `conditions` -> `[]`

### Condition defaults

- missing `severity` -> `low`
- missing `bodyArea` -> `abdomen`
- missing `color` -> grey `#c9d3da`

## Room assignment rules

The current mapper assigns payloads onto arbitrary room slots.

Current behavior:

- first use rectangular `care` rooms
- if needed, fall back to other rectangular rooms
- assign JSON entries in order
- do not currently match by real room number

This means:

- JSON room item 1 goes to slot 1
- JSON room item 2 goes to slot 2
- and so on

If you need true room-ID matching later, that is a future enhancement.

## Clickability rules

This is the exact frontend behavior:

- room clickable = `room.type === "care"` and `room.patientId` exists
- room not clickable = no `patientId`

When live data is applied:

- assigned rooms get:
  - `patientId`
  - `priority`
  - `occupancyStatus`
  - optional `displayColor`

- unassigned care rooms are forced to:
  - `priority: "none"`
  - `displayColor: "#c9d3da"`
  - `occupancyStatus: "unknown"`
  - `patientId: undefined`

Result:

- assigned rooms can open patient detail mode
- unassigned rooms stay grey and inert

## Frontend helper for live JSON

Use:

- `syncLiveRoomFeedToStore(...)`

File:

- [src/lib/live-data/client.ts](/d:/Repositories/Hackathons/Healthcare-Frontend/src/lib/live-data/client.ts)

What it does:

1. reads the current floorplan from Zustand
2. injects that as `baseFloorplan` if you did not provide one
3. posts to `POST /api/live-room-data`
4. writes the returned floorplan + patients back into Zustand

### Example frontend usage

```ts
import { syncLiveRoomFeedToStore } from '@/lib/live-data/client';

await syncLiveRoomFeedToStore({
  rooms: [
    {
      roomExternalId: 'WARD-A-101',
      roomName: 'Room A-101',
      roomType: 'care',
      priority: 'high',
      occupancyStatus: 'occupied',
      patient: {
        id: 'PT-2048',
        displayId: 'PT-2048',
        age: 82,
        summary: 'High-support patient record.',
        conditions: [
          {
            id: 'PT-2048-heart-1',
            label: 'Cardiac rhythm review',
            bodyArea: 'heart',
            severity: 'high',
            color: '#e79653',
            shortDescription: 'Short irregular rhythm episodes.',
            detailedNotes: 'Document symptom timing during transfers.',
            monitoring: 'Telemetry review every 30 to 60 minutes.',
            recommendedSupport: 'Head-elevated rest.'
          }
        ]
      }
    }
  ]
});
```

## Backend integration recommendations

### Recommended pattern

1. let the frontend restore or analyze a floorplan
2. let your backend produce room/patient JSON
3. call `POST /api/live-room-data` with:
   - `rooms`
   - the current `baseFloorplan`
4. apply the response to the frontend store

### If your backend talks directly to the frontend route

Use:

```bash
curl -X POST http://localhost:3000/api/live-room-data \
  -H "Content-Type: application/json" \
  -d @your-live-room-feed.json
```

### If you need the example template first

Use:

```bash
curl http://localhost:3000/api/live-room-data
```

## Deprecated path

`POST /api/analyze-floorplan` is now deprecated as a server-side rich-analysis route.

The active upload flow no longer depends on it.

The frontend upload path now uses only the local worker-based heuristic analyzer.

## Files that matter for integration

- Live room-data route:
  - [app/api/live-room-data/route.ts](/d:/Repositories/Hackathons/Healthcare-Frontend/app/api/live-room-data/route.ts)

- Live room-data normalizer and mapper:
  - [src/lib/live-data/apply-live-room-data.ts](/d:/Repositories/Hackathons/Healthcare-Frontend/src/lib/live-data/apply-live-room-data.ts)

- Frontend live-data helper:
  - [src/lib/live-data/client.ts](/d:/Repositories/Hackathons/Healthcare-Frontend/src/lib/live-data/client.ts)

- Example live-data payload:
  - [public/examples/live-room-data.template.json](/d:/Repositories/Hackathons/Healthcare-Frontend/public/examples/live-room-data.template.json)

- Local heuristic upload pipeline:
  - [src/lib/analysis/pipeline-client.ts](/d:/Repositories/Hackathons/Healthcare-Frontend/src/lib/analysis/pipeline-client.ts)

## Validation

```bash
npm run typecheck
npm run build
npm test
```

## Model credit

The bundled human model credit is preserved in [public/credits/human-model.txt](/d:/Repositories/Hackathons/Healthcare-Frontend/public/credits/human-model.txt).
