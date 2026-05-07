import type { ScaleName } from '../types';

export const SCALES: Record<ScaleName, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  NaturalMinor: [0, 2, 3, 5, 7, 8, 10],
  HarmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  MelodicMinor: [0, 2, 3, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  PentatonicMajor: [0, 2, 4, 7, 9],
  PentatonicMinor: [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  WholeTone: [0, 2, 4, 6, 8, 10],
  Diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  Augmented: [0, 3, 4, 7, 8, 11],
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
  compressor: DynamicsCompressorNode | null = null;
  delay: DelayNode | null = null;
  delayFeedback: GainNode | null = null;
  dryGain: GainNode | null = null;
  wetGain: GainNode | null = null;
  outputTap: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  voices: Map<number, { osc: OscillatorNode, gain: GainNode, timeoutId?: any }> = new Map();
  waveform: OscillatorType = 'sawtooth';

  init() {
    if (!this.ctx) {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('Web Audio API is not supported in this browser');
      this.ctx = new AudioContextCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Lower volume to prevent clipping
      
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      this.delay = this.ctx.createDelay();
      this.delay.delayTime.value = 0.33; // ~1/8th note at 90bpm
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.25;
      
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2500;
      this.filter.Q.value = 1.2;
      
      // Routing
      this.filter.connect(this.masterGain);
      
      this.dryGain = this.ctx.createGain();
      this.wetGain = this.ctx.createGain();
      
      // Default to 50% mix
      this.dryGain.gain.value = 1.0;
      this.wetGain.gain.value = 0.5;

      this.masterGain.connect(this.dryGain);
      this.dryGain.connect(this.compressor);

      this.masterGain.connect(this.delay);
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.wetGain);
      this.wetGain.connect(this.compressor);

      this.outputTap = this.ctx.createGain();
      this.outputTap.gain.value = 1;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.compressor.connect(this.outputTap);
      this.outputTap.connect(this.analyser);
      this.outputTap.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') {
      void this.ctx.resume();
    }
  }

  async unlock() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    const running = this.ctx?.state === 'running';
    console.debug('[polyfield] audio unlock()', { state: this.ctx?.state, running });
    return running;
  }

  isRunning() {
    return this.ctx?.state === 'running';
  }



  getAnalyser() {
    return this.analyser;
  }
  setWaveform(wf: OscillatorType) {
    this.waveform = wf;
    this.voices.forEach(v => v.osc.type = wf);
  }

  setDelay(enabled: boolean, mix: number) {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;
    const now = this.ctx.currentTime;
    // We use a constant power crossfade or simple linear mix
    // For a simple delay, keeping dry at 1.0 and scaling wet is often preferred,
    // but a true crossfade is: dry = 1 - mix, wet = mix.
    // Let's use a standard additive mix where dry is always 1.0 and wet scales,
    // or a true mix. The prompt says "mix between full delay and none".
    // Let's do true mix: 
    if (enabled) {
      this.wetGain.gain.setTargetAtTime(mix, now, 0.05);
      this.dryGain.gain.setTargetAtTime(1 - mix, now, 0.05);
    } else {
      this.wetGain.gain.setTargetAtTime(0, now, 0.05);
      this.dryGain.gain.setTargetAtTime(1, now, 0.05);
    }
  }

  playNote(midiNote: number, velocity: number = 100) {
    if (!this.ctx || !this.filter) {
      console.debug('[polyfield] playNote skipped: audio graph not ready', { midiNote, velocity, hasCtx: Boolean(this.ctx), hasFilter: Boolean(this.filter) });
      return;
    }
    
    const now = this.ctx.currentTime;
    console.debug('[polyfield] playNote', { midiNote, velocity, state: this.ctx.state });
    let voice = this.voices.get(midiNote);
    
    if (voice) {
      if (voice.timeoutId) {
        clearTimeout(voice.timeoutId);
        voice.timeoutId = undefined;
      }
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime((velocity / 127) * 0.5, now + 0.02);
      return;
    }
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = this.waveform;
    osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime((velocity / 127) * 0.5, now + 0.02);
    
    osc.connect(gain);
    gain.connect(this.filter);
    
    osc.start(now);
    this.voices.set(midiNote, { osc, gain });
  }

  stopNote(midiNote: number) {
    if (!this.ctx) return;
    const voice = this.voices.get(midiNote);
    if (voice && !voice.timeoutId) {
      const now = this.ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.15);
      
      voice.timeoutId = setTimeout(() => {
        try {
          voice.osc.stop();
          voice.osc.disconnect();
          voice.gain.disconnect();
        } catch (e) {}
        this.voices.delete(midiNote);
      }, 200);
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
  onClockTick: (() => void) | null = null;
  onStart: (() => void) | null = null;
  onStop: (() => void) | null = null;

  mpeEnabled = false;
  midiChannel = 1; // 1-16
  private nextMpeChannel = 2; // 2-16
  private activeNotes = new Map<number, number>(); // note -> channel

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
    
    if (status === 0xF8) {
      if (this.onClockTick) this.onClockTick();
    } else if (status === 0xFA) {
      if (this.onStart) this.onStart();
    } else if (status === 0xFC) {
      if (this.onStop) this.onStop();
    } else if (cmd === 9 && data2 > 0) {
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
      let channel = this.midiChannel - 1; // 0-15
      if (this.mpeEnabled) {
        channel = this.nextMpeChannel - 1;
        this.nextMpeChannel++;
        if (this.nextMpeChannel > 16) this.nextMpeChannel = 2;
      }
      
      this.activeNotes.set(midiNote, channel);
      this.outputPort.send([0x90 | channel, midiNote, velocity]);
    }
  }

  stopNote(midiNote: number) {
    if (this.outputPort) {
      const channel = this.activeNotes.get(midiNote) ?? (this.midiChannel - 1);
      this.outputPort.send([0x80 | channel, midiNote, 0]);
      this.activeNotes.delete(midiNote);
    }
  }

  sendClock() {
    this.outputPort?.send([0xF8]);
  }

  sendStart() {
    this.outputPort?.send([0xFA]);
  }

  sendStop() {
    this.outputPort?.send([0xFC]);
  }
}

export const audio = new AudioEngine();
export const midi = new MidiEngine();
