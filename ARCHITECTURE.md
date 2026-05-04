# Polyfield Architecture

This document describes how Polyfield currently works after the Svelte standardisation, and which files are responsible for each part of the runtime.

## High-level runtime model

Polyfield is a **single-page SvelteKit app** that renders one production UI route (`/`) and drives:

1. A multitouch/pointer-based harmonic performance surface.
2. A browser WebAudio synthesizer (internal sound engine).
3. Browser WebMIDI input/output, including optional MIDI clock and MPE output behavior.

The app’s behavior is state-driven:
- UI controls mutate an `AppState` object.
- Pointer and MIDI events produce active note sets.
- Reactive logic maps these inputs into note-on / note-off operations for both the audio engine and MIDI output.

---

## Source of truth (UI)

### `src/routes/+page.svelte`
This is the **only production UI surface** and contains the app orchestration logic and page composition:

- `PolyfieldHeader` component for top bar / status indicators.
- Left settings panel (Harmony, Voices, Internal Synth, MIDI Out, Motion, Presets).
- Main touch surface with grid, pointer overlays, active-note chips, and fullscreen controls.

It also contains the orchestration logic that wires UI state to audio/MIDI engines:

- Initializes MIDI and fullscreen listeners in `onMount`.
- Tracks current pointer positions and notes.
- Merges pointer-derived notes with MIDI-in notes.
- Supports `free` and `arp` motion modes.
- Runs internal clock ticks when `clockSource === 'internal'`.
- Pushes waveform/delay/channel/MPE/output changes to engine instances.

---

## App state model

### `src/lib/types.ts`
Defines canonical domain types used by the app:

- `ScaleName` (supported scales).
- `Waveform` (oscillator types).
- `AppState` (all performance and routing settings).

`AppState` is the shared shape for:
- Voice toggles and intervals.
- Scale/root/grid config.
- Motion mode, clock source, BPM.
- MIDI channel + MPE toggle.
- Touch mode mono/poly.
- Delay enabled/mix.

---

## Audio + MIDI engines

### `src/lib/audio/engine.ts`
Core musical engine module. Exports:

- `SCALES`: scale interval maps.
- `getNoteInScale(scale, root, degree)`: converts scale degree to MIDI note.
- `audio`: singleton `AudioEngine` instance.
- `midi`: singleton `MidiEngine` instance.

#### `AudioEngine`
Responsibilities:
- Lazy-create and resume `AudioContext` on first user interaction.
- Maintain master signal chain (`filter`, `delay`, `compressor`, dry/wet gains).
- Manage polyphonic oscillator voices keyed by MIDI note.
- Apply waveform updates to active voices.
- Apply delay dry/wet mix and enable/disable behavior.
- Handle smooth note attack/release envelopes.

#### `MidiEngine`
Responsibilities:
- Acquire `MIDIAccess` and register all MIDI input listeners.
- Decode incoming messages (note on/off, clock tick/start/stop).
- Expose callback hooks (`onNoteOn`, `onNoteOff`, `onClockTick`, etc.) used by UI logic.
- Enumerate/select output ports.
- Send note on/off and MIDI clock.
- Support optional MPE-style round-robin channel assignment (channels 2–16).

### `src/audio/engine.ts`
Legacy parallel copy of the engine module (non-`$lib` path). It mirrors the same domain behavior and currently exists for compatibility with old import paths.

---

## Routing / SvelteKit integration

### `src/routes/+layout.svelte`
Layout wrapper for the route tree.

### `src/routes/+layout.ts`
Exports `prerender = true`, ensuring static generation behavior for SvelteKit pages.

### `svelte.config.js`
Uses `@sveltejs/adapter-static` and outputs static artifacts to `dist`, with support for `BASE_PATH` normalization for subpath deployments.

This is what keeps deployment compatibility with GitHub Pages-style hosting (static output + base path support).

---

## Build/tooling

### `vite.config.ts`
Uses SvelteKit’s Vite plugin (`sveltekit()`), and retains:
- env define for `process.env.GEMINI_API_KEY` usage.
- HMR toggle behavior via `DISABLE_HMR`.

### `tsconfig.json`
Extends SvelteKit-generated TS config and sets bundler-style module resolution/options.

### `package.json`
Defines scripts:
- `dev`, `build`, `preview`, `clean`, `lint`.

React runtime/tooling dependencies were removed so runtime and build pipeline are now aligned with SvelteKit.

---

## Event flow details

1. **Pointer down/move/up on touch surface**
   - Normalize pointer coordinates to [0,1].
   - Map X/Y to scale degrees using `gridSteps`.
   - Compute voice notes via `getNoteInScale` and interval offsets.
   - Update per-pointer note sets.

2. **Mode behavior**
   - `free`: all held pointer notes are sustained.
   - `arp`: clock-triggered single-note stepping through held notes.

3. **Clock source**
   - `internal`: `setInterval` sends MIDI clock (24 PPQN) and advances arp every 6 ticks (16th note).
   - `external`: MIDI clock callbacks advance arp.

4. **MIDI input merge**
   - Incoming MIDI notes are added to active-note set and played on internal synth.
   - MIDI-derived notes are protected from pointer-stop logic until MIDI note-off arrives.

5. **Output routing**
   - Internal audio always follows active notes.
   - MIDI out mirrors played/stopped notes when an output is selected.

---

## Persistence

Preset controls in `+page.svelte` save/load `AppState` to `localStorage` key:
- `polyfield_preset`

---

## Why removing React files did not remove functionality

All app behavior was already represented in `src/routes/+page.svelte` plus the engine modules. React files (`src/main.tsx`, `src/App.tsx`) were duplicate runtime entry code from a parallel implementation and were no longer the production surface.

Therefore, standardising on Svelte removed duplicated framework entrypoints while preserving:
- Touch surface interaction.
- Audio synthesis.
- MIDI in/out + clock behavior.
- Voice/scale/interval controls.
- Motion modes.
- Preset save/load.

The operational source of truth is now unambiguous: **Svelte route UI + shared engine module(s)**.


### `src/lib/components/PolyfieldHeader.svelte`
Extracted UI component that renders the top status/header bar and exposes a control-toggle callback plus MIDI status indicator props.

### `src/lib/components/ControlPanel.svelte`
Settings/sidebar component split from `+page.svelte`; owns UI controls for harmony, voices, synth, MIDI, motion, and presets via bindable `state` props.

### `src/lib/components/TouchSurface.svelte`
Interactive performance surface component split from `+page.svelte`; renders the grid, pointer overlays, active notes, and fullscreen/open-controls affordances while receiving pointer handlers as props.
