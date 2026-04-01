export type ScaleName = 'Major' | 'Minor' | 'PentatonicMajor' | 'PentatonicMinor' | 'Dorian' | 'Mixolydian' | 'Chromatic';
export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface AppState {
  scale: ScaleName;
  rootNote: number; // MIDI note, e.g., 48 for C3
  voicesActive: [boolean, boolean, boolean, boolean];
  intervals: [number, number, number, number]; // e.g. [0, 2, 0, 2] for root, 3rd, root, 3rd
  waveform: Waveform;
  gridSteps: number;
  motionMode: 'free' | 'arp';
  arpRate: number;
}
