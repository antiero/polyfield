## Polyfield

Polyfield is a browser-based polyphonic touch instrument built with Svelte + Web Audio + Web MIDI.

You play notes by touching and dragging on a 2D grid:
- **X position** selects scale degree(s) for upper voices.
- **Y position** selects scale degree(s) for lower voices (one octave down by default).
- Up to four independent voices can be layered with per-voice interval offsets.

It can send the same notes to:
- the internal synth engine (audio output), and
- an optional external MIDI output device.

---

## How Polyfield works

### 1) Pitch mapping
Polyfield maps touch coordinates into scale degrees, then converts those degrees into MIDI note numbers using the selected scale and root note.

For each active voice:
- A scale degree is computed from the touch position and grid resolution.
- A per-voice interval offset is added.
- The result is converted to a MIDI pitch in the selected scale.

### 2) Voice generation (internal audio)
Each held note creates/updates an oscillator voice in the Web Audio graph:
- Oscillator waveform: Saw / Sine / Square / Triangle.
- Per-note gain envelope: short attack + release smoothing.
- Shared processing chain: low-pass filter → dry/wet delay mix → compressor → output.

### 3) Motion modes
- **Free**: all held notes sound continuously.
- **Arp**: held notes become an arpeggio pool; one note is stepped on the rhythmic clock.

### 4) Timing/clock
Arp stepping runs on 16th-note pulses derived from MIDI clock ticks (24 PPQN):
- **Internal clock**: generated from selected BPM.
- **External clock**: follows incoming MIDI transport/clock.

### 5) Audio unlock behavior (important on Safari/iOS)
Browsers may start audio contexts in a suspended state until a user gesture occurs.
Polyfield explicitly resumes audio on touch and also shows a **Touch To Play** gesture button when audio is not yet unlocked.

This means first contact on the grid (or the overlay button) is used to unlock audio, after which drag/touch note gestures produce audible output.

---

## Controls reference

### Harmonic controls
- **Scale**: chooses the pitch collection used for mapping.
- **Root**: base MIDI note/root for scale mapping.
- **Grid Steps**: sets mapping resolution across X/Y axes.
- **Voice 1–4 Enable**: turns each mapped voice lane on/off.
- **Voice 1–4 Interval**: transposes each voice lane by scale degrees.

### Synthesis controls
- **Waveform**: oscillator shape for all active synth voices.
- **Delay Enabled**: toggles delay processing.
- **Delay Mix**: blend between dry and delayed signal.

### Performance controls
- **Touch Mode**:
  - **Mono**: newest pointer replaces prior touch state.
  - **Poly**: multiple simultaneous pointers are tracked independently.
- **Motion Mode**:
  - **Free**: chord/cluster sustain while held.
  - **Arp**: sequenced playback through held notes.

### Clock + MIDI controls
- **Clock Source**: Internal or External MIDI clock.
- **BPM**: tempo used when Internal clock is selected.
- **MPE Enabled**: enables MPE-oriented channel behavior for outgoing MIDI note assignment.
- **MIDI Channel**: base MIDI channel for non-MPE output.
- **MIDI Output**: target external MIDI output port.

### Visual/debug controls
- **Show Oscilloscope**: overlays an analyser scope of the output signal path.

---

## Touch workflow (what should happen)
1. Touch grid (or tap **Touch To Play** if shown).
2. Audio context is resumed from that gesture when needed.
3. Pointer position is mapped to note set.
4. Notes are sent to internal audio and optional MIDI output.
5. Dragging updates notes in real time.
6. Releasing touch triggers note release.

If you see note labels updating but hear no sound, verify:
- browser/site tab is not muted,
- output device is correct,
- system volume is up,
- audio unlock overlay has been triggered at least once.

---

## Run locally

**Prerequisites:** Node.js

1. Install dependencies
   - `npm install`
2. Start dev server
   - `npm run dev`
3. Open the local URL printed by Vite.
