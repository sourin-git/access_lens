# AccessLens scene

The repository was empty when this scene was added in `3f243ce`. The main application now integrates it through `src/main.ts` and `src/styles.css`; the scene and its independent harness remain intact. `src/types.ts` is the shared contract for `AccessibilityProfile` and `AppState`; the scene does not own an app state store. See [README.md](README.md) for the complete app.

## Run the independent page

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173/scene-test.html**. All styles and test controls belong to this page. The test entry is `src/scene-test.ts`.

Choose each profile, toggle the illustrative scan, select every element by pointer or the equivalent keyboard buttons, clear selection, toggle the narrow viewport, request a resize, and dispose/remount. The selected ID is announced in a status region. Native controls support Tab, Enter, and Space.

Check **Force DOM fallback** to remount without WebGL, or open `/scene-test.html?fallback=1`. The harness sets `canvas.dataset.accessLensForceFallback = 'true'` before creating the scene. This opt-in affects only that canvas and does not extend the public API. Actual WebGL initialization failures and context loss use the same DOM alternative. Uncheck the box to remount the 3D scene.

## Integration handoff

Import `createAccessLensScene` from **`src/scene/createScene.ts`** and shared types from **`src/types.ts`**. The factory and its five returned method signatures are unchanged. Mount once per canvas; dispose the previous instance before remounting. The integration layer owns app state and keyboard-equivalent selection controls.

```ts
import { createAccessLensScene } from './scene/createScene';
import type { AppState } from './types';

const canvas = document.querySelector<HTMLCanvasElement>('#access-lens-canvas')!;
// The host must give the canvas a definite CSS size, for example:
// <div style="height:560px"><canvas id="access-lens-canvas"
//   style="display:block;width:100%;height:100%"></canvas></div>
const scene = createAccessLensScene(canvas, {
  onSelectElement(id) {
    // Update the integration layer's selected element and report UI.
    console.log('Selected:', id);
  },
});

function syncScene(state: AppState, scanActive: boolean, selectedId: string | null) {
  scene.setProfile(state.reducedMotion ? 'reduced-motion' : state.profile);
  scene.setScanActive(scanActive);
  scene.setSelectedElement(selectedId); // null clears selection
}

// Call syncScene with your integration layer's state on mount and updates.
// resize() is optional: the observer handles container-only CSS size changes.
scene.resize();

// On teardown, before removing the canvas:
scene.dispose();
scene.dispose(); // safe; calls to setters/resize after disposal are ignored
```

Give the host a definite height and the canvas `display:block; width:100%; height:100%`. In flex/grid layouts, allow the host to shrink (`min-width:0; min-height:0` where appropriate). Do not size its CSS box from the canvas's drawing-buffer attributes. A `ResizeObserver` watches the canvas; changing only the container's width/height updates the buffer, camera aspect, and framing without a window resize or explicit API call. Zero-sized/hidden hosts are tolerated and resize when shown. Pixel ratio is capped at 1.75.

The renderer clears with alpha zero; the UI controls the background. Keep room in the host for the DOM alternative, which is inserted immediately after the canvas. A fixed-height host should allow fallback content to scroll. The module only changes/restores the canvas's display/cursor styles and owns its fallback's scoped shadow styles.

`setSelectedElement` updates visuals without emitting a callback. Pointer and fallback-button selection update the scene and call `onSelectElement(id)`. Repeated user activation of an already-selected element still emits its ID. Empty-space clicks do not clear selection or emit a callback; the integration's clear control must call `setSelectedElement(null)`. Unknown IDs also clear selection. Profile/scan/selection setters preserve each other's state and can be applied in any order; when multiple selection calls occur, the last one wins. A remount creates fresh default scene state: reapply the integration's profile, scan flag, and selected ID.

## Reduced motion and AppState mapping

Map **`AppState.reducedMotion === true`** to **`scene.setProfile('reduced-motion')`**; otherwise call **`scene.setProfile(state.profile)`**, as in `syncScene` above. Keep the user's chosen `state.profile` in the integration layer so it can be restored when the override is disabled. If `state.profile` itself is `'reduced-motion'`, motion stays disabled regardless of the separate boolean.

The OS preference is an independent safety floor: effective reduced motion is `matchMedia('(prefers-reduced-motion: reduce)').matches || sceneProfile === 'reduced-motion'`. It is read at initialization and tracked live. Selecting any other profile while the OS requests reduced motion preserves that profile's appearance and keeps motion off. A live OS change or switch to `'reduced-motion'` stops decorative animation/camera drift immediately; selection and resize rendering remain functional with no recurring animation frame. Removing the OS preference resumes motion only if the current scene profile allows it.

**API limitation requiring UI coordination:** the single profile argument cannot combine an app-only `reducedMotion: true` override with low-vision, dyslexia, or motor scene appearance. The mapping prioritizes motion safety and temporarily uses the reduced-motion appearance. OS-driven reduced motion can combine with every visual profile. An independent scene motion override would require an agreed future API change; none was introduced here. `AppState.contrast` and `textScale` also have no scene setters: apply them to the UI layer; coordinate any additional scene behavior separately. No app-wide store is included.

## Stable selectable IDs

| ID | Website element |
| --- | --- |
| `navigation` | Top navigation bar |
| `hero` | Hero heading and supporting line |
| `body-text` | Body copy panel |
| `hero-image` | Procedural illustration |
| `primary-button` | Primary call to action |

## Profiles and states

| Profile | Visible changes |
| --- | --- |
| `default` | Blue glass, lime accents, gentle panel float/camera drift, 64 faint particles |
| `low-vision` | Larger type, opaque dark panels, bright outlines, stronger illustration strokes, no particles |
| `dyslexia` | Warm panels and ink, Verdana text, increased body line spacing, no particles |
| `motor` | Larger pointer hit regions, stronger outlines, lime primary button |
| `reduced-motion` | Fixed camera and panels, static particles, static scan/result; selection remains functional |

These are illustrative visual adaptations, not clinical simulations or a guarantee of suitability for an individual user.

Idle has no scanner or issue markers. A scan sweeps gently for four seconds and then displays static lime diamond markers on body text, image, and button. Reduced motion shows a static scan band and issue markers immediately. Turning scanning off clears the scan and markers. A lime frame independently identifies the selected element. All issue data is illustrative; there is no real accessibility analysis.

`setScanActive(true)` is idempotent while already active; restart by setting `false` then `true`. Selection clearing does not clear scan results. Profile changes preserve selection and scan state; switching to reduced motion during a scan completes the illustrative result immediately. Returning to an animated profile retains that result until the flag is reset. There is no scan-progress/completion callback: the UI must not infer real analysis completion from these visuals.

The scene uses direct Three.js, shared geometry/materials, canvas-generated textures, a single particle draw call, and shader effects without postprocessing or external assets. Pixel ratio is capped at 1.75. Animation pauses in hidden documents. Reduced motion renders on demand with no recurring animation frame. Disposal disconnects the observer, removes listeners/fallback DOM, deduplicates and disposes geometries/materials/textures, resets WebGL state, and disposes the renderer. It retains the canvas's reusable context for remounting. Resetting state prevents texture-unpack errors when a new renderer reuses that context after canvas-texture uploads; lost contexts skip the reset.

## Fallback and dependencies

WebGL initialization failure or context loss replaces the canvas with a readable, selectable DOM alternative. It supports the same selection callbacks, profile updates, scan flag, and clearing. Its illustrative scan result is immediate. Disposal removes the fallback and its listeners and restores the canvas display style. Context loss remains in fallback until remounting; the browser must restore a genuinely lost context before WebGL can be mounted again. One active instance per canvas is supported.

The initially empty repository needed these setup dependencies: runtime `three@0.186.1`; development `@types/three@0.186.0`, `typescript@5.9.3`, `vite@8.3.2`, and browser-test-only `playwright@1.63.0`. The complete app adds no dependencies. Vite builds both `index.html` and `scene-test.html`, sharing the original scene chunk and preserving the independent harness.

## Validation

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm run test:scene
```

The browser test starts its own local Vite server on port 5175, closes it after the run, and writes screenshots/results to ignored `.scene-test-artifacts/`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use another compatible local Chromium executable.

All **18 browser checks** pass in headless Chromium with software WebGL: transparent rendering, all five profiles, all five raycast selections, keyboard selection/clearing, no queued frames under reduced motion, static and animated scans, detected markers, container-only resizing without explicit resize (including raycasting after resizing), explicit resize, repeated disposal/remounting, forced fallback, fallback state/keyboard selection/cleanup, OS reduced-motion initialization and all profile changes, live OS preference changes, and real WebGL context loss. A public-API regression test covers 240 setter-order permutations across all five profiles in WebGL and fallback, visual selection clearing, scan resetting, unknown IDs, callback silence for programmatic setters, repeated disposal, post-disposal calls, and canvas reuse. Remounts and pixel-readback assertions also check `gl.getError()`; disposal is checked for restored texture-unpack state. TypeScript strict checks and the production build pass. No page or shader errors were reported. Native driver diagnostics from the test's pixel-readback assertions are kept in the ignored artifact directory.

Limitations: rendering has not been checked on physical GPU hardware, Safari, or Firefox. The scene chunk is about 550 kB (139 kB gzip), which triggers Vite's default 500 kB chunk warning. The main app lazy-loads it with a loading state. The scene module does not implement an analysis service or app-wide controls; the UI report is predefined illustrative data. Its report timer remains independent of the scene's visual scan, as there is no scene completion callback.
