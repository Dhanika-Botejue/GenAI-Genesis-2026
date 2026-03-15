# Halo

Halo combines an outbound voice workflow with two web interfaces: a call-control dashboard and a spatial patient-monitoring view. The backend in [app.py](./app.py) uses [Flask](https://flask.palletsprojects.com/), [Twilio Voice](https://www.twilio.com/docs/voice), [ElevenLabs Text to Speech](https://elevenlabs.io/docs), and the [OpenAI Python SDK](https://github.com/openai/openai-python) pointed at [OpenRouter](https://openrouter.ai/) to place a call, synthesize prompts, classify spoken replies, and persist structured results in [database.json](./database.json). The operator-facing web app in [frontend/](./frontend/) provides a simple call launcher and live transcript view, while [visualization/](./visualization/) contains a separate React-based 3D care-space demo built with [Vite](https://vite.dev/), [Three.js](https://threejs.org/), [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction), and [Zustand](https://zustand-demo.pmnd.rs/).

The repository is organized as a demo system rather than a single deployable package. [ai_service.py](./ai_service.py) handles response intent classification, [tts_service.py](./tts_service.py) caches generated audio prompts in [audio/](./audio/), [db.py](./db.py) manages the lightweight JSON store, and [frontend/src/app/components/PatientCaller.tsx](./frontend/src/app/components/PatientCaller.tsx) polls the backend for new responses while the call is active. The 3D dashboard in [visualization/src/App.tsx](./visualization/src/App.tsx) and [visualization/src/components/](./visualization/src/components/) models rooms, patients, body-area signals, and camera transitions directly in code.

## Interesting techniques

- Server-generated TwiML in [app.py](./app.py) drives the phone flow with [Twilio `VoiceResponse` and `Gather`](https://www.twilio.com/docs/voice/twiml).
- The operator UI uses the browser [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) plus [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval) in [frontend/src/app/components/PatientCaller.tsx](./frontend/src/app/components/PatientCaller.tsx) to poll call results and update the transcript without a websocket layer.
- The backend uses simple audio-file caching in [tts_service.py](./tts_service.py) so repeated prompts are not regenerated on every demo call.
- The 3D view animates camera targeting and scene objects frame-by-frame with React Three Fiber's render loop in [visualization/src/components/HospitalScene.tsx](./visualization/src/components/HospitalScene.tsx) and [visualization/src/components/PriorityPulse.tsx](./visualization/src/components/PriorityPulse.tsx).
- Room and condition selection is intentionally scheduled with React's [`startTransition`](https://react.dev/reference/react/startTransition) in [visualization/src/components/RoomMesh.tsx](./visualization/src/components/RoomMesh.tsx), [visualization/src/components/PriorityPulse.tsx](./visualization/src/components/PriorityPulse.tsx), and [visualization/src/components/InfoPanel.tsx](./visualization/src/components/InfoPanel.tsx) to keep interaction responsive while the scene updates.
- The 3D dashboard lazy-loads the main scene with [`lazy`](https://react.dev/reference/react/lazy) and [`Suspense`](https://react.dev/reference/react/Suspense) in [visualization/src/App.tsx](./visualization/src/App.tsx), which keeps the shell available while the heavier scene code loads.
- The visualization overlays HTML labels inside the WebGL scene through Drei helpers in [visualization/src/components/FloorPlan.tsx](./visualization/src/components/FloorPlan.tsx), [visualization/src/components/RoomMesh.tsx](./visualization/src/components/RoomMesh.tsx), and [visualization/src/components/PatientModel.tsx](./visualization/src/components/PatientModel.tsx).
- Styling in [visualization/src/index.css](./visualization/src/index.css) uses layered [`radial-gradient()`](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient), [`linear-gradient()`](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient), and [`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter) to create the glass-panel UI used around the 3D canvas.
- The scene uses pointer hit-testing and miss handling in [visualization/src/components/HospitalScene.tsx](./visualization/src/components/HospitalScene.tsx) to reset selection when the user clicks outside an active room.

## Libraries and technologies worth noting

- [OpenRouter](https://openrouter.ai/) is wired into the official [OpenAI Python SDK](https://github.com/openai/openai-python) through `base_url` in [ai_service.py](./ai_service.py), which is a useful pattern when you want the OpenAI client ergonomics against a different inference gateway.
- [Twilio Programmable Voice](https://www.twilio.com/docs/voice) is used for outbound calling and webhook-driven call state, not just SMS or verification flows.
- [ElevenLabs](https://elevenlabs.io/docs) is used with a fixed voice ID in [tts_service.py](./tts_service.py), and the generated files are served back from [audio/](./audio/) as regular HTTP assets.
- [Next.js](https://nextjs.org/) in [frontend/](./frontend/) is used only for the operator UI, while the 3D dashboard is a separate [Vite](https://vite.dev/) app in [visualization/](./visualization/). That split is unusual enough to be worth calling out.
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction) and [@react-three/drei](https://github.com/pmndrs/drei) are used heavily in [visualization/src/components/](./visualization/src/components/) for scene composition, labels, controls, and shadows.
- [Zustand](https://zustand-demo.pmnd.rs/) in [visualization/src/store/useHospitalStore.ts](./visualization/src/store/useHospitalStore.ts) keeps room and condition state outside the scene graph, which helps coordinate the canvas and side panel without heavier state tooling.
- [Tailwind CSS v4](https://tailwindcss.com/) appears in [frontend/](./frontend/), while [Tailwind CSS v3](https://tailwindcss.com/) is used in [visualization/](./visualization/). That version split may matter if you plan to unify the frontends.
- [Geist](https://vercel.com/font) and [Geist Mono](https://vercel.com/font) are loaded through `next/font` in [frontend/src/app/layout.tsx](./frontend/src/app/layout.tsx).
- [`Aptos`](https://learn.microsoft.com/en-us/typography/font-list/aptos) is referenced in [visualization/src/index.css](./visualization/src/index.css) and [visualization/src/App.tsx](./visualization/src/App.tsx) as the preferred dashboard display font.

## Project structure

```text
.
├── ai_service.py
├── app.py
├── database.json
├── db.py
├── LICENSE
├── README.md
├── tts_service.py
├── twilio-test.py
├── audio/
├── frontend/
│   ├── public/
│   └── src/
│       └── app/
│           └── components/
└── visualization/
    ├── public/
    └── src/
        ├── assets/
        ├── components/
        ├── data/
        └── store/
```

`audio/` stores generated speech prompts and reusable prefix clips served by the Flask app.

`frontend/src/app/components/` contains the operator-facing patient call UI for triggering a call and reading responses.

`visualization/src/components/` contains the 3D scene, room meshes, patient model, and side-panel components.

`visualization/src/data/` holds the static room, patient, and condition dataset that drives the scene.

`visualization/src/store/` contains the Zustand store used to coordinate selection state across the canvas and detail panel.
