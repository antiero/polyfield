import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio, midi, getNoteInScale, SCALES } from './audio/engine';
import { AppState, ScaleName, Waveform } from './types';
import { Volume2 } from 'lucide-react';

const INITIAL_STATE: AppState = {
  scale: 'PentatonicMinor',
  rootNote: 48, // C3
  voicesActive: [true, true, true, false],
  intervals: [0, 2, 0, 2], // V1: root, V2: 3rd, V3: root, V4: 3rd
  waveform: 'sawtooth',
  gridSteps: 21, // 3 octaves of a 7-note scale
  motionMode: 'free',
  arpRate: 150,
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [pointerNotes, setPointerNotes] = useState<Set<number>>(new Set());
  const [midiNotes, setMidiNotes] = useState<Set<number>>(new Set());
  const [heldNotes, setHeldNotes] = useState<number[]>([]);
  const [pointerPos, setPointerPos] = useState<{x: number, y: number} | null>(null);
  const [isDown, setIsDown] = useState(false);
  const [midiOutputs, setMidiOutputs] = useState<{id: string, name: string|null}[]>([]);
  const [selectedMidiOut, setSelectedMidiOut] = useState<string>('');

  const surfaceRef = useRef<HTMLDivElement>(null);
  
  const activeNotes = new Set([...pointerNotes, ...midiNotes]);

  useEffect(() => {
    midi.init().then(() => {
      const outputs = midi.getOutputs();
      setMidiOutputs(outputs);
      if (outputs.length > 0) {
        setSelectedMidiOut(outputs[0].id);
      }
    });

    midi.onNoteOn = (note, velocity) => {
      audio.init();
      audio.playNote(note, velocity);
      setMidiNotes(prev => new Set(prev).add(note));
    };

    midi.onNoteOff = (note) => {
      audio.stopNote(note);
      setMidiNotes(prev => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
    };
  }, []);

  const updateNotes = useCallback((x: number, y: number, down: boolean) => {
    if (!down) {
      setHeldNotes([]);
      return;
    }

    const degreeX = Math.floor(x * state.gridSteps);
    const degreeY = Math.floor((1 - y) * state.gridSteps);

    const newNotes = new Set<number>();

    if (state.voicesActive[0]) newNotes.add(getNoteInScale(state.scale, state.rootNote, degreeX + state.intervals[0]));
    if (state.voicesActive[1]) newNotes.add(getNoteInScale(state.scale, state.rootNote, degreeX + state.intervals[1]));
    if (state.voicesActive[2]) newNotes.add(getNoteInScale(state.scale, state.rootNote - 12, degreeY + state.intervals[2]));
    if (state.voicesActive[3]) newNotes.add(getNoteInScale(state.scale, state.rootNote - 12, degreeY + state.intervals[3]));

    setHeldNotes(Array.from(newNotes).sort((a,b)=>a-b));
  }, [state]);

  useEffect(() => {
    if (state.motionMode === 'free') {
      setPointerNotes(prev => {
        const newNotes = new Set(heldNotes);
        prev.forEach(note => {
          if (!newNotes.has(note) && !midiNotes.has(note)) {
            audio.stopNote(note);
            midi.stopNote(note);
          }
        });
        newNotes.forEach(note => {
          if (!prev.has(note) && !midiNotes.has(note)) {
            audio.playNote(note);
            midi.playNote(note);
          }
        });
        return newNotes;
      });
    }
  }, [heldNotes, state.motionMode, midiNotes]);

  useEffect(() => {
    if (state.motionMode !== 'arp') return;
    
    if (heldNotes.length === 0) {
      setPointerNotes(prev => {
        prev.forEach(note => {
          if (!midiNotes.has(note)) {
            audio.stopNote(note);
            midi.stopNote(note);
          }
        });
        return new Set();
      });
      return;
    }

    let arpIndex = 0;
    // Play first note immediately
    const playNext = () => {
      const noteToPlay = heldNotes[arpIndex % heldNotes.length];
      setPointerNotes(prevNotes => {
        prevNotes.forEach(note => {
          if (!midiNotes.has(note)) {
            audio.stopNote(note);
            midi.stopNote(note);
          }
        });
        if (!midiNotes.has(noteToPlay)) {
          audio.playNote(noteToPlay);
          midi.playNote(noteToPlay);
        }
        return new Set([noteToPlay]);
      });
      arpIndex++;
    };
    
    playNext();
    const intervalId = setInterval(playNext, state.arpRate);

    return () => clearInterval(intervalId);
  }, [heldNotes, state.motionMode, state.arpRate, midiNotes]);

  const handlePointerDown = (e: React.PointerEvent) => {
    audio.init(); // Initialize audio context on first interaction
    setIsDown(true);
    if (surfaceRef.current) {
      surfaceRef.current.setPointerCapture(e.pointerId);
      const rect = surfaceRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setPointerPos({x, y});
      updateNotes(x, y, true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDown || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setPointerPos({x, y});
    updateNotes(x, y, true);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDown(false);
    setPointerPos(null);
    updateNotes(0, 0, false);
    if (surfaceRef.current) {
      surfaceRef.current.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    audio.setWaveform(state.waveform);
  }, [state.waveform]);

  useEffect(() => {
    if (selectedMidiOut) {
      midi.setOutput(selectedMidiOut);
    }
  }, [selectedMidiOut]);

  // Re-evaluate notes if state changes while holding
  useEffect(() => {
    if (isDown && pointerPos) {
      updateNotes(pointerPos.x, pointerPos.y, true);
    }
  }, [state.scale, state.rootNote, state.voicesActive, state.intervals, state.gridSteps, updateNotes, isDown, pointerPos]);

  const savePreset = () => {
    localStorage.setItem('polyfield_preset', JSON.stringify(state));
  };
  const loadPreset = () => {
    const saved = localStorage.getItem('polyfield_preset');
    if (saved) {
      setState(JSON.parse(saved));
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-mono flex flex-col selection:bg-[#F27D26] selection:text-white">
      {/* Header */}
      <header className="p-4 border-b border-[#141414] flex justify-between items-center bg-[#E4E3E0] z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tighter uppercase">PolyField</h1>
          <span className="text-xs opacity-50 uppercase tracking-widest hidden sm:inline-block">Harmonic Performance Instrument</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Volume2 size={16} />
            <span className="uppercase text-xs">WebAudio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${midiOutputs.length > 0 ? 'bg-[#00FF00]' : 'bg-red-500'}`} />
            <span className="uppercase text-xs">MIDI</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Controls Sidebar */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[#141414] bg-[#E4E3E0] overflow-y-auto flex flex-col">
          <div className="p-6 space-y-8">
            
            {/* Scale & Root */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Harmony</h2>
              
              <div className="space-y-2">
                <label className="text-xs uppercase opacity-70">Scale</label>
                <select 
                  className="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase appearance-none cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                  value={state.scale}
                  onChange={e => setState(s => ({...s, scale: e.target.value as ScaleName}))}
                >
                  {Object.keys(SCALES).map(s => <option key={s} value={s} className="bg-[#E4E3E0] text-[#141414]">{s}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase opacity-70">Root Note</label>
                <select 
                  className="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase appearance-none cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                  value={state.rootNote}
                  onChange={e => setState(s => ({...s, rootNote: parseInt(e.target.value)}))}
                >
                  <option value={36} className="bg-[#E4E3E0] text-[#141414]">C2 (36)</option>
                  <option value={48} className="bg-[#E4E3E0] text-[#141414]">C3 (48)</option>
                  <option value={60} className="bg-[#E4E3E0] text-[#141414]">C4 (60)</option>
                </select>
              </div>
            </section>

            {/* Voices */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Voices</h2>
              <div className="grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <button
                      className={`w-full p-2 text-xs uppercase border border-[#141414] transition-colors ${state.voicesActive[i] ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                      onClick={() => {
                        const newVoices = [...state.voicesActive] as [boolean, boolean, boolean, boolean];
                        newVoices[i] = !newVoices[i];
                        setState(s => ({...s, voicesActive: newVoices}));
                      }}
                    >
                      Voice {i + 1}
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-50">INT</span>
                      <input 
                        type="number" 
                        className="w-12 bg-transparent border-b border-[#141414] text-right focus:outline-none"
                        value={state.intervals[i]}
                        onChange={e => {
                          const newInts = [...state.intervals] as [number, number, number, number];
                          newInts[i] = parseInt(e.target.value) || 0;
                          setState(s => ({...s, intervals: newInts}));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Synth */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Internal Synth</h2>
              <div className="flex gap-2">
                {['sine', 'square', 'sawtooth', 'triangle'].map(wf => (
                  <button
                    key={wf}
                    className={`flex-1 p-2 text-[10px] uppercase border border-[#141414] transition-colors ${state.waveform === wf ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                    onClick={() => setState(s => ({...s, waveform: wf as Waveform}))}
                  >
                    {wf.substring(0, 3)}
                  </button>
                ))}
              </div>
            </section>

            {/* MIDI */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">MIDI Out</h2>
              <select 
                className="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase appearance-none cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                value={selectedMidiOut}
                onChange={e => setSelectedMidiOut(e.target.value)}
              >
                <option value="" className="bg-[#E4E3E0] text-[#141414]">None</option>
                {midiOutputs.map(out => (
                  <option key={out.id} value={out.id} className="bg-[#E4E3E0] text-[#141414]">{out.name}</option>
                ))}
              </select>
            </section>

            {/* Rhythm & Motion */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Motion</h2>
              <div className="flex gap-2">
                <button
                  className={`flex-1 p-2 text-xs uppercase border border-[#141414] transition-colors ${state.motionMode === 'free' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                  onClick={() => setState(s => ({...s, motionMode: 'free'}))}
                >
                  Free
                </button>
                <button
                  className={`flex-1 p-2 text-xs uppercase border border-[#141414] transition-colors ${state.motionMode === 'arp' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                  onClick={() => setState(s => ({...s, motionMode: 'arp'}))}
                >
                  Arp
                </button>
              </div>
              {state.motionMode === 'arp' && (
                <div className="flex items-center justify-between text-xs">
                  <span className="opacity-70 uppercase">Rate (ms)</span>
                  <input 
                    type="number" 
                    className="w-16 bg-transparent border-b border-[#141414] text-right focus:outline-none"
                    value={state.arpRate}
                    step={10}
                    onChange={e => setState(s => ({...s, arpRate: parseInt(e.target.value) || 150}))}
                  />
                </div>
              )}
            </section>

            {/* Presets */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Presets</h2>
              <div className="flex gap-2">
                <button
                  className="flex-1 p-2 text-xs uppercase border border-[#141414] bg-transparent hover:bg-black/5 transition-colors"
                  onClick={savePreset}
                >
                  Save
                </button>
                <button
                  className="flex-1 p-2 text-xs uppercase border border-[#141414] bg-transparent hover:bg-black/5 transition-colors"
                  onClick={loadPreset}
                >
                  Load
                </button>
              </div>
            </section>

          </div>
        </aside>

        {/* Performance Surface */}
        <div className="flex-1 relative bg-[#141414] touch-none overflow-hidden p-4 lg:p-8 flex items-center justify-center">
          <div 
            ref={surfaceRef}
            className="w-full h-full max-w-4xl max-h-[800px] relative cursor-crosshair border border-[#333] bg-[#1A1A1A] shadow-2xl rounded-sm overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              {Array.from({length: state.gridSteps}).map((_, i) => (
                <div key={`h-${i}`} className="w-full h-px bg-[#E4E3E0]" />
              ))}
            </div>
            <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
              {Array.from({length: state.gridSteps}).map((_, i) => (
                <div key={`v-${i}`} className="h-full w-px bg-[#E4E3E0]" />
              ))}
            </div>

            {/* Active Highlights */}
            {isDown && pointerPos && (
              <>
                {/* X-Axis Highlight (Voice 1 & 2) */}
                <div 
                  className="absolute top-0 bottom-0 bg-[#F27D26]/20 border-x border-[#F27D26]/50 transition-all duration-75"
                  style={{
                    left: `${(Math.floor(pointerPos.x * state.gridSteps) / state.gridSteps) * 100}%`,
                    width: `${(1 / state.gridSteps) * 100}%`
                  }}
                />
                {/* Y-Axis Highlight (Voice 3 & 4) */}
                <div 
                  className="absolute left-0 right-0 bg-[#00FF00]/20 border-y border-[#00FF00]/50 transition-all duration-75"
                  style={{
                    top: `${(Math.floor(pointerPos.y * state.gridSteps) / state.gridSteps) * 100}%`,
                    height: `${(1 / state.gridSteps) * 100}%`
                  }}
                />
                
                {/* Crosshair */}
                <div 
                  className="absolute w-4 h-4 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  style={{
                    left: `${pointerPos.x * 100}%`,
                    top: `${pointerPos.y * 100}%`
                  }}
                />
              </>
            )}

            {/* Active Notes Display */}
            <div className="absolute bottom-4 left-4 pointer-events-none flex gap-2">
              {Array.from(activeNotes).sort((a,b)=>a-b).map(note => (
                <div key={note} className="px-2 py-1 bg-white/10 text-white text-xs font-mono rounded backdrop-blur-sm border border-white/20">
                  {note}
                </div>
              ))}
            </div>
            
            {!isDown && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-[#E4E3E0]/30 uppercase tracking-widest text-sm">Touch to play</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
