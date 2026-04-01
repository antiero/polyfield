import { ScaleName } from '../types';

export const SCALES: Record<ScaleName, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  PentatonicMajor: [0, 2, 4, 7, 9],
  PentatonicMinor: [0, 3, 5, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export function getNoteInScale(scaleName: ScaleName, rootMidi: number, degree: number) {
  const scale = SCALES[scaleName];
  const octave = Math.floor(degree / scale.length);
  const noteIndex = degree % scale.length;
  const normalizedIndex = noteIndex < 0 ? noteIndex + scale.length : noteIndex;
  const normalizedOctave = noteIndex < 0 ? octave - 1 : octave;
  
  return rootMidi + (normalizedOctave * 12) + scale[normalizedIndex];
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  filter: BiquadFilterNode | null = null;
  voices: Map<number, { osc: OscillatorNode, gain: GainNode }> = new Map();
  waveform: OscillatorType = 'sawtooth';

  init() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.15;
      
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2000;
      this.filter.Q.value = 1.5;
      
      this.filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setWaveform(wf: OscillatorType) {
    this.waveform = wf;
    this.voices.forEach(v => v.osc.type = wf);
  }

  playNote(midiNote: number, velocity: number = 100) {
    if (!this.ctx || !this.filter) return;
    
    if (this.voices.has(midiNote)) {
      return; // Already playing
    }
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = this.waveform;
    osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime((velocity / 127), this.ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.filter);
    
    osc.start();
    this.voices.set(midiNote, { osc, gain });
  }

  stopNote(midiNote: number) {
    if (!this.ctx) return;
    const voice = this.voices.get(midiNote);
    if (voice) {
      const now = this.ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.1);
      voice.osc.stop(now + 0.1);
      this.voices.delete(midiNote);
    }
  }
  
  stopAll() {
    this.voices.forEach((_, note) => this.stopNote(note));
  }
}

export class MidiEngine {
  midiAccess: MIDIAccess | null = null;
  outputPort: MIDIOutput | null = null;
  onNoteOn: ((note: number, velocity: number, channel: number) => void) | null = null;
  onNoteOff: ((note: number, channel: number) => void) | null = null;

  async init() {
    if (navigator.requestMIDIAccess) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess();
        const outputs = Array.from(this.midiAccess.outputs.values());
        if (outputs.length > 0) {
          this.outputPort = outputs[0];
        }

        // Listen to all inputs
        for (const input of this.midiAccess.inputs.values()) {
          input.onmidimessage = this.handleMidiMessage.bind(this);
        }
        
        this.midiAccess.onstatechange = () => {
          if (!this.midiAccess) return;
          for (const input of this.midiAccess.inputs.values()) {
            input.onmidimessage = this.handleMidiMessage.bind(this);
          }
        };
      } catch (e) {
        console.warn("MIDI access denied or not supported");
      }
    }
  }

  handleMidiMessage(event: MIDIMessageEvent) {
    if (!event.data) return;
    const [status, data1, data2] = event.data;
    const cmd = status >> 4;
    const channel = status & 0xf;
    
    if (cmd === 9 && data2 > 0) {
      if (this.onNoteOn) this.onNoteOn(data1, data2, channel);
    } else if (cmd === 8 || (cmd === 9 && data2 === 0)) {
      if (this.onNoteOff) this.onNoteOff(data1, channel);
    }
  }

  setOutput(portId: string) {
    if (this.midiAccess) {
      this.outputPort = this.midiAccess.outputs.get(portId) || null;
    }
  }

  getOutputs() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values()).map(p => ({ id: p.id, name: p.name }));
  }

  playNote(midiNote: number, velocity: number = 100) {
    if (this.outputPort) {
      this.outputPort.send([0x90, midiNote, velocity]);
    }
  }

  stopNote(midiNote: number) {
    if (this.outputPort) {
      this.outputPort.send([0x80, midiNote, 0]);
    }
  }
}

export const audio = new AudioEngine();
export const midi = new MidiEngine();
