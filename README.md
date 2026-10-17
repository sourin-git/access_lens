# AccessLens

A local, interactive accessibility learning demo built with Vite, TypeScript, direct Three.js, and vanilla HTML/CSS. The example website and findings are procedural/predefined. **No website is submitted, tested, or audited.**

## Run

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The independent scene laboratory remains at **/scene-test.html**.

For the production preview:

```sh
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/**. Both HTML entries are included in `dist/`. Nothing needs to be deployed.

## What works

- A responsive 3D explorer and element report with keyboard-equivalent selection for all five website elements.
- A four-second demo scan with idle, scanning, and completed states, reset/restart, three illustrative findings, and two review notes. Severity, explanation, and suggested improvements appear after completion. Clearing selection preserves findings.
- Five accessibility profiles, UI high contrast, text scaling from 100–150%, an independent app motion override, and preference reset.
- Scene-to-report and report-to-scene selection. Selection does not move keyboard focus unexpectedly. Live messages announce scan transitions and selection, rather than every progress update.
- A readable, selectable DOM alternative for WebGL failure/context loss. The report and demo remain usable if the scene module cannot load. Retry remounts the scene and resets the demo while preserving display preferences.
- Scan timers, observers, event listeners, and scene resources are disposed on page teardown; a restored page remounts after BFCache navigation.

## State and integration

`src/main.ts` owns the single `AppState` defined in `src/types.ts`. Scan phase and selected element are transient state in that same controller. `src/report.ts` holds immutable illustrative data and renders values supplied by the controller; it does not own another app store. The original scene API and all scene files are preserved from `3f243ce`.

The scene profile is always derived with:

```ts
state.reducedMotion ? 'reduced-motion' : state.profile
```

The app's motion override temporarily replaces the scene's visual profile. The UI keeps the selected perspective, and disabling the override restores its scene appearance. The OS reduced-motion preference remains an independent floor for every profile. Contrast and text scale apply to the UI; the existing scene API has no separate setters for them. See [SCENE.md](SCENE.md) for the scene contract, sizing, selection IDs, fallback, and lifecycle details.

The controller's four-second demo timer drives the report; the scene has no scan-completion callback. Under reduced motion its illustrative markers appear immediately, while the report keeps the same short demo flow. Neither represents audit progress or real analysis.

## Validate

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm run test:scene
npm run test:app
```

`test:app` builds both entries and tests the production preview on port 5176. Its 11 checks cover scan completion/reset, controls, both selection directions, keyboard use, OS motion preferences, mobile layout and text scaling, WebGL/module-download fallback, teardown, and BFCache remounting. The scene suite uses port 5175 and retains its independent 18 checks/240 setter-order permutations. Screenshots and results are written to ignored `.scene-test-artifacts/`.

No new dependencies are needed for the main app. Browser validation uses the existing Playwright dependency and headless Chromium with software WebGL. Physical GPU hardware, Safari, and Firefox are not covered. The Three.js scene chunk still triggers Vite's size warning; the app loads it separately and provides a loading state. All findings are examples for learning, not compliance conclusions or individual disability simulations.
