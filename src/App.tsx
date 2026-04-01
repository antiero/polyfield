import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audio, midi, getNoteInScale, SCALES } from './audio/engine';
import { AppState, ScaleName, Waveform } from './types';
import { Volume2, Settings, X, Save, Download, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_STATE: AppState = {
  scale: 'PentatonicMinor',
  rootNote: 48, // C3
  voicesActive: [true, true, true, false],
  intervals: [0, 2, 0, 2], // V1: root, V2: 3rd, V3: root, V4: 3rd
  waveform: 'sawtooth',
  gridSteps: 21, // 3 octaves of a 7-note scale
  motionMode: 'free',
  bpm: 120,
  clockSource: 'internal',
  mpeEnabled: false,
  midiChannel: 1,
  touchMode: 'mono',
  delayEnabled: true,
  delayMix: 0.5,
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [pointerNotes, setPointerNotes] = useState<Set<number>>(new Set());
  const [midiNotes, setMidiNotes] = useState<Set<number>>(new Set());
  const [pointers, setPointers] = useState<Record<number, {x: number, y: number, notes: number[]}>>({});
  const [midiOutputs, setMidiOutputs] = useState<{id: string, name: string|null}[]>([]);
  const [selectedMidiOut, setSelectedMidiOut] = useState<string>('');
  const [arpTrigger, setArpTrigger] = useState(0);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const arpIndexRef = useRef(0);
  
  const activeNotes = new Set([...pointerNotes, ...midiNotes]);

  // Derived held notes from all active pointers
  const allHeldNotes = React.useMemo(() => {
    const notes = new Set<number>();
    (Object.values(pointers) as {notes: number[]}[]).forEach(p => p.notes.forEach(n => notes.add(n)));
    return Array.from(notes).sort((a, b) => a - b);
  }, [pointers]);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeScreen(large);
      if (large) setIsControlsOpen(false); // Reset mobile toggle when going to desktop
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    midi.mpeEnabled = state.mpeEnabled;
    midi.midiChannel = state.midiChannel;
  }, [state.mpeEnabled, state.midiChannel]);

  useEffect(() => {
    let tickCount = 0;
    let intervalId: any;

    const handleSixteenth = () => {
      setArpTrigger(t => t + 1);
    };

    if (state.clockSource === 'internal') {
      const tickMs = 60000 / state.bpm / 24;
      intervalId = setInterval(() => {
        midi.sendClock();
        if (tickCount % 6 === 0) {
          handleSixteenth();
        }
        tickCount++;
      }, tickMs);
    } else {
      midi.onClockTick = () => {
        if (tickCount % 6 === 0) {
          handleSixteenth();
        }
        tickCount++;
      };
      midi.onStart = () => { tickCount = 0; arpIndexRef.current = 0; };
      midi.onStop = () => { tickCount = 0; };
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      midi.onClockTick = null;
      midi.onStart = null;
      midi.onStop = null;
    };
  }, [state.clockSource, state.bpm]);

  const calculateNotes = useCallback((x: number, y: number) => {
    const degreeX = Math.floor(x * state.gridSteps);
    const degreeY = Math.floor((1 - y) * state.gridSteps);

    const newNotes = new Set<number>();

    if (state.voicesActive[0]) newNotes.add(getNoteInScale(state.scale, state.rootNote, degreeX + state.intervals[0]));
    if (state.voicesActive[1]) newNotes.add(getNoteInScale(state.scale, state.rootNote, degreeX + state.intervals[1]));
    if (state.voicesActive[2]) newNotes.add(getNoteInScale(state.scale, state.rootNote - 12, degreeY + state.intervals[2]));
    if (state.voicesActive[3]) newNotes.add(getNoteInScale(state.scale, state.rootNote - 12, degreeY + state.intervals[3]));

    return Array.from(newNotes).sort((a, b) => a - b);
  }, [state]);

  useEffect(() => {
    if (state.motionMode === 'free') {
      setPointerNotes(prev => {
        const newNotes = new Set(allHeldNotes);
        prev.forEach((note: number) => {
          if (!newNotes.has(note) && !midiNotes.has(note)) {
            audio.stopNote(note);
            midi.stopNote(note);
          }
        });
        newNotes.forEach((note: number) => {
          if (!prev.has(note) && !midiNotes.has(note)) {
            audio.playNote(note);
            midi.playNote(note);
          }
        });
        return newNotes;
      });
    }
  }, [allHeldNotes, state.motionMode, midiNotes]);

  useEffect(() => {
    if (state.motionMode === 'arp' && allHeldNotes.length === 0) {
      setPointerNotes(prev => {
        prev.forEach((note: number) => {
          if (!midiNotes.has(note)) {
            audio.stopNote(note);
            midi.stopNote(note);
          }
        });
        return new Set();
      });
      arpIndexRef.current = 0;
    }
  }, [allHeldNotes, state.motionMode, midiNotes]);

  useEffect(() => {
    if (state.motionMode !== 'arp') return;
    if (allHeldNotes.length === 0) return;

    const noteToPlay = allHeldNotes[arpIndexRef.current % allHeldNotes.length];
    setPointerNotes(prevNotes => {
      prevNotes.forEach((note: number) => {
        if (!midiNotes.has(note) && note !== noteToPlay) {
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
    arpIndexRef.current++;
  }, [arpTrigger, state.motionMode]); // Intentionally omit allHeldNotes to only trigger on clock

  const handlePointerDown = (e: React.PointerEvent) => {
    audio.init(); // Initialize audio context on first interaction
    if (surfaceRef.current) {
      surfaceRef.current.setPointerCapture(e.pointerId);
      const rect = surfaceRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      
      const notes = calculateNotes(x, y);
      
      setPointers(prev => {
        if (state.touchMode === 'mono') {
          // In mono mode, we replace all pointers with this one
          return { [e.pointerId]: { x, y, notes } };
        } else {
          return { ...prev, [e.pointerId]: { x, y, notes } };
        }
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!surfaceRef.current || !pointers[e.pointerId]) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    const notes = calculateNotes(x, y);
    
    setPointers(prev => ({
      ...prev,
      [e.pointerId]: { x, y, notes }
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setPointers(prev => {
      const next = { ...prev };
      delete next[e.pointerId];
      return next;
    });
    if (surfaceRef.current) {
      surfaceRef.current.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    audio.setWaveform(state.waveform);
  }, [state.waveform]);

  useEffect(() => {
    audio.setDelay(state.delayEnabled, state.delayMix);
  }, [state.delayEnabled, state.delayMix]);

  useEffect(() => {
    if (selectedMidiOut) {
      midi.setOutput(selectedMidiOut);
    }
  }, [selectedMidiOut]);

  // Re-evaluate notes if state changes while holding
  useEffect(() => {
    setPointers(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(id => {
        const pId = parseInt(id);
        const p = next[pId];
        const newNotes = calculateNotes(p.x, p.y);
        if (JSON.stringify(newNotes) !== JSON.stringify(p.notes)) {
          next[pId] = { ...p, notes: newNotes };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [state.scale, state.rootNote, state.voicesActive, state.intervals, state.gridSteps, calculateNotes]);

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
    <div className="h-screen bg-[#E4E3E0] text-[#141414] font-mono flex flex-col selection:bg-[#F27D26] selection:text-white overflow-hidden">
      {/* Header */}
      <header className="p-3 lg:p-4 border-b border-[#141414] flex justify-between items-center bg-[#E4E3E0] z-30 shrink-0">
        <div className="flex items-center gap-3 lg:gap-4">
          <button 
            onClick={() => setIsControlsOpen(!isControlsOpen)}
            className="lg:hidden p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <Settings size={20} />
          </button>
          <h1 className="text-lg lg:text-xl font-bold tracking-tighter uppercase">PolyField</h1>
          <span className="text-[10px] opacity-50 uppercase tracking-widest hidden sm:inline-block">Harmonic Performance</span>
        </div>
        <div className="flex items-center gap-3 lg:gap-4 text-sm">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <Volume2 size={14} className="lg:w-4 lg:h-4" />
            <span className="uppercase text-[10px] lg:text-xs">Audio</span>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${midiOutputs.length > 0 ? 'bg-[#00FF00]' : 'bg-red-500'}`} />
            <span className="uppercase text-[10px] lg:text-xs">MIDI</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Controls Sidebar (Desktop) / Slide-over (Mobile) */}
        <AnimatePresence>
          {(isControlsOpen || isLargeScreen) && (
            <motion.aside 
              initial={isLargeScreen ? false : { x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`
                fixed inset-y-0 left-0 z-40 w-80 bg-[#E4E3E0] border-r border-[#141414] flex flex-col
                lg:static lg:z-0 lg:translate-x-0 lg:block
                ${isControlsOpen ? 'shadow-2xl' : ''}
              `}
            >
              <div className="p-4 lg:hidden border-b border-[#141414] flex justify-between items-center bg-[#D4D3D0]">
                <span className="text-xs font-bold uppercase tracking-widest">Settings</span>
                <button onClick={() => setIsControlsOpen(false)} className="p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24 lg:pb-8">
                
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
                          V{i + 1}
                        </button>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="opacity-50">INT</span>
                          <input 
                            type="number" 
                            className="w-10 bg-transparent border-b border-[#141414] text-right focus:outline-none"
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
                  <div className="flex gap-1">
                    {['sine', 'square', 'sawtooth', 'triangle'].map(wf => (
                      <button
                        key={wf}
                        className={`flex-1 p-1.5 text-[9px] uppercase border border-[#141414] transition-colors ${state.waveform === wf ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                        onClick={() => setState(s => ({...s, waveform: wf as Waveform}))}
                      >
                        {wf.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase opacity-70">Delay</label>
                      <button
                        className={`px-3 py-1 text-[10px] uppercase border border-[#141414] transition-colors ${state.delayEnabled ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                        onClick={() => setState(s => ({...s, delayEnabled: !s.delayEnabled}))}
                      >
                        {state.delayEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {state.delayEnabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-50 uppercase">Mix</span>
                        <input 
                          type="range" 
                          min="0" max="1" step="0.01"
                          className="flex-1 accent-[#141414]"
                          value={state.delayMix}
                          onChange={e => setState(s => ({...s, delayMix: parseFloat(e.target.value)}))}
                        />
                        <span className="text-[10px] opacity-50 w-8 text-right">{Math.round(state.delayMix * 100)}%</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* MIDI */}
                <section className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">MIDI Out</h2>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-70">Port</label>
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
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-xs uppercase opacity-70">Ch</label>
                      <select 
                        className="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase appearance-none cursor-pointer hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                        value={state.midiChannel}
                        onChange={e => setState(s => ({...s, midiChannel: parseInt(e.target.value)}))}
                        disabled={state.mpeEnabled}
                      >
                        {Array.from({length: 16}).map((_, i) => (
                          <option key={i+1} value={i+1} className="bg-[#E4E3E0] text-[#141414]">{i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-xs uppercase opacity-70">MPE</label>
                      <button
                        className={`w-full p-2 text-sm uppercase border border-[#141414] transition-colors ${state.mpeEnabled ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                        onClick={() => setState(s => ({...s, mpeEnabled: !s.mpeEnabled}))}
                      >
                        {state.mpeEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Rhythm & Motion */}
                <section className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Motion</h2>
                  
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-70">Touch Mode</label>
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 p-2 text-xs uppercase border border-[#141414] transition-colors ${state.touchMode === 'mono' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                        onClick={() => setState(s => ({...s, touchMode: 'mono'}))}
                      >
                        Mono
                      </button>
                      <button
                        className={`flex-1 p-2 text-xs uppercase border border-[#141414] transition-colors ${state.touchMode === 'poly' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                        onClick={() => setState(s => ({...s, touchMode: 'poly'}))}
                      >
                        Poly
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-70">Play Mode</label>
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
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      className={`flex-1 p-1.5 text-[9px] uppercase border border-[#141414] transition-colors ${state.clockSource === 'internal' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                      onClick={() => setState(s => ({...s, clockSource: 'internal'}))}
                    >
                      INT
                    </button>
                    <button
                      className={`flex-1 p-1.5 text-[9px] uppercase border border-[#141414] transition-colors ${state.clockSource === 'external' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent hover:bg-black/5'}`}
                      onClick={() => setState(s => ({...s, clockSource: 'external'}))}
                    >
                      EXT
                    </button>
                  </div>

                  {state.clockSource === 'internal' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-70 uppercase">BPM</span>
                      <input 
                        type="number" 
                        className="w-12 bg-transparent border-b border-[#141414] text-right focus:outline-none"
                        value={state.bpm}
                        step={1}
                        min={30}
                        max={300}
                        onChange={e => setState(s => ({...s, bpm: parseInt(e.target.value) || 120}))}
                      />
                    </div>
                  )}
                </section>

                {/* Presets */}
                <section className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Presets</h2>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 p-2 text-xs uppercase border border-[#141414] bg-transparent hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
                      onClick={savePreset}
                    >
                      <Save size={14} /> Save
                    </button>
                    <button
                      className="flex-1 p-2 text-xs uppercase border border-[#141414] bg-transparent hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
                      onClick={loadPreset}
                    >
                      <Download size={14} /> Load
                    </button>
                  </div>
                </section>

              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Backdrop for mobile */}
        <AnimatePresence>
          {isControlsOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsControlsOpen(false)}
              className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-[2px]"
            />
          )}
        </AnimatePresence>

        {/* Performance Surface */}
        <div className="flex-1 relative bg-[#141414] touch-none overflow-hidden p-2 lg:p-8 flex items-center justify-center">
          <div 
            ref={surfaceRef}
            className="w-full h-full relative cursor-crosshair border border-[#333] bg-[#1A1A1A] shadow-2xl rounded-sm overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 lg:opacity-20">
              {Array.from({length: state.gridSteps}).map((_, i) => (
                <div key={`h-${i}`} className="w-full h-px bg-[#E4E3E0]" />
              ))}
            </div>
            <div className="absolute inset-0 flex justify-between pointer-events-none opacity-10 lg:opacity-20">
              {Array.from({length: state.gridSteps}).map((_, i) => (
                <div key={`v-${i}`} className="h-full w-px bg-[#E4E3E0]" />
              ))}
            </div>

            {/* Active Highlights */}
            {(Object.entries(pointers) as [string, {x: number, y: number, notes: number[]}][]).map(([id, p]) => (
              <React.Fragment key={id}>
                {/* X-Axis Highlight (Voice 1 & 2) */}
                <div 
                  className="absolute top-0 bottom-0 bg-[#F27D26]/20 border-x border-[#F27D26]/40 transition-all duration-75"
                  style={{
                    left: `${(Math.floor(p.x * state.gridSteps) / state.gridSteps) * 100}%`,
                    width: `${(1 / state.gridSteps) * 100}%`
                  }}
                />
                {/* Y-Axis Highlight (Voice 3 & 4) */}
                <div 
                  className="absolute left-0 right-0 bg-[#00FF00]/20 border-y border-[#00FF00]/40 transition-all duration-75"
                  style={{
                    top: `${(Math.floor(p.y * state.gridSteps) / state.gridSteps) * 100}%`,
                    height: `${(1 / state.gridSteps) * 100}%`
                  }}
                />
                
                {/* Crosshair */}
                <div 
                  className="absolute w-6 h-6 lg:w-4 lg:h-4 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.6)]"
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`
                  }}
                />
              </React.Fragment>
            ))}

            {/* Active Notes Display */}
            <div className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 pointer-events-none flex flex-wrap gap-1.5 lg:gap-2 max-w-[80%]">
              {Array.from(activeNotes).sort((a,b)=>a-b).map(note => (
                <div key={note} className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-white/10 text-white text-[9px] lg:text-xs font-mono rounded backdrop-blur-sm border border-white/20">
                  {note}
                </div>
              ))}
            </div>
            
            {!Object.keys(pointers).length && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-[#E4E3E0]/20 uppercase tracking-[0.2em] text-[10px] lg:text-sm">Touch to play</p>
              </div>
            )}

            {/* Mobile Controls Summoner */}
            {!isControlsOpen && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsControlsOpen(true);
                }}
                className="lg:hidden absolute top-4 left-4 p-2 bg-white/5 border border-white/10 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
