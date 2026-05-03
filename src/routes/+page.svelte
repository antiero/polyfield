<script lang="ts">
  import { onMount } from 'svelte';
  import { Settings, X, Save, Download, ChevronRight, Volume2 } from 'lucide-svelte';
  import { audio, midi, getNoteInScale, SCALES } from '$lib/audio/engine';
  import type { AppState, ScaleName, Waveform } from '$lib/types';

  const INITIAL_STATE: AppState = {
    scale: 'PentatonicMinor', rootNote: 48, voicesActive: [true, true, true, false], intervals: [0, 2, 0, 2],
    waveform: 'sawtooth', gridSteps: 21, motionMode: 'free', bpm: 120, clockSource: 'internal', mpeEnabled: false,
    midiChannel: 1, touchMode: 'mono', delayEnabled: true, delayMix: 0.5
  };
  let state: AppState = { ...INITIAL_STATE };
  let pointerNotes = new Set<number>(); let midiNotes = new Set<number>();
  let pointers: Record<number, {x:number;y:number;notes:number[]}> = {};
  let midiOutputs: {id:string;name:string|null}[] = []; let selectedMidiOut = '';
  let isControlsOpen = false; let isLargeScreen = true; let surfaceRef: HTMLDivElement;
  let arpIndex = 0; let arpTrigger = 0;
  $: activeNotes = new Set([...pointerNotes, ...midiNotes]);
  $: allHeldNotes = Array.from(new Set(Object.values(pointers).flatMap((p)=>calculateNotes(p.x,p.y)))).sort((a,b)=>a-b);

  const calculateNotes = (x:number,y:number)=>{
    const dx = Math.floor(x*state.gridSteps), dy = Math.floor((1-y)*state.gridSteps); const notes = new Set<number>();
    if (state.voicesActive[0]) notes.add(getNoteInScale(state.scale, state.rootNote, dx + state.intervals[0]));
    if (state.voicesActive[1]) notes.add(getNoteInScale(state.scale, state.rootNote, dx + state.intervals[1]));
    if (state.voicesActive[2]) notes.add(getNoteInScale(state.scale, state.rootNote - 12, dy + state.intervals[2]));
    if (state.voicesActive[3]) notes.add(getNoteInScale(state.scale, state.rootNote - 12, dy + state.intervals[3]));
    return Array.from(notes).sort((a,b)=>a-b);
  };

  function syncFreeMode(){ if(state.motionMode!=='free') return; const n=new Set(allHeldNotes); for(const note of pointerNotes){ if(!n.has(note)&&!midiNotes.has(note)){audio.stopNote(note);midi.stopNote(note);} } for(const note of n){ if(!pointerNotes.has(note)&&!midiNotes.has(note)){audio.playNote(note);midi.playNote(note);} } pointerNotes=n; }
  function stepArp(){ if(state.motionMode!=='arp'||allHeldNotes.length===0) return; const note=allHeldNotes[arpIndex%allHeldNotes.length]; for(const n of pointerNotes){ if(!midiNotes.has(n)&&n!==note){audio.stopNote(n);midi.stopNote(n);} } if(!midiNotes.has(note)){audio.playNote(note);midi.playNote(note);} pointerNotes=new Set([note]); arpIndex++; }

  onMount(async ()=>{
    isLargeScreen = window.innerWidth >= 1024;
    window.addEventListener('resize', ()=>{isLargeScreen=window.innerWidth>=1024; if(isLargeScreen) isControlsOpen=false;});
    await midi.init(); midiOutputs = midi.getOutputs(); if(midiOutputs[0]) selectedMidiOut = midiOutputs[0].id;
    midi.onNoteOn = (note, velocity)=>{audio.init(); audio.playNote(note,velocity); midiNotes = new Set(midiNotes).add(note);};
    midi.onNoteOff = (note)=>{audio.stopNote(note); const n=new Set(midiNotes); n.delete(note); midiNotes=n;};

    let tick = 0; let id: ReturnType<typeof setInterval> | undefined;
    const setClock=()=>{
      if(id) clearInterval(id); midi.onClockTick=null; midi.onStart=null; midi.onStop=null;
      if(state.clockSource==='internal'){ const tickMs=60000/state.bpm/24; id=setInterval(()=>{midi.sendClock(); if(tick%6===0){arpTrigger++; stepArp();} tick++;},tickMs); }
      else { midi.onClockTick=()=>{if(tick%6===0){arpTrigger++; stepArp();} tick++;}; midi.onStart=()=>{tick=0;arpIndex=0;}; midi.onStop=()=>{tick=0;}; }
    }; setClock();
    return ()=>{ if(id) clearInterval(id); };
  });

  $: midi.mpeEnabled = state.mpeEnabled; $: midi.midiChannel = state.midiChannel;
  $: audio.setWaveform(state.waveform); $: audio.setDelay(state.delayEnabled, state.delayMix);
  $: if(selectedMidiOut) midi.setOutput(selectedMidiOut);
  $: { syncFreeMode(); if(state.motionMode==='arp'&&allHeldNotes.length===0){ for(const n of pointerNotes){if(!midiNotes.has(n)){audio.stopNote(n);midi.stopNote(n);}} pointerNotes=new Set(); arpIndex=0; }}

  function pointerDown(e: PointerEvent){ audio.init(); surfaceRef.setPointerCapture(e.pointerId); const r=surfaceRef.getBoundingClientRect(); const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)); const notes=calculateNotes(x,y); pointers = state.touchMode==='mono'?{[e.pointerId]:{x,y,notes}}:{...pointers,[e.pointerId]:{x,y,notes}}; }
  function pointerMove(e: PointerEvent){ if(!pointers[e.pointerId]) return; const r=surfaceRef.getBoundingClientRect(); const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)); pointers={...pointers,[e.pointerId]:{x,y,notes:calculateNotes(x,y)}}; }
  function pointerUp(e: PointerEvent){ const n={...pointers}; delete n[e.pointerId]; pointers=n; surfaceRef.releasePointerCapture(e.pointerId); }
  const savePreset=()=>localStorage.setItem('polyfield_preset',JSON.stringify(state));
  const loadPreset=()=>{const s=localStorage.getItem('polyfield_preset'); if(s) state=JSON.parse(s);};
</script>

<div class="h-screen bg-[#E4E3E0] text-[#141414] font-mono flex flex-col overflow-hidden">
<header class="p-3 border-b border-[#141414] flex justify-between items-center"><div class="flex items-center gap-3"><button on:click={() => isControlsOpen=!isControlsOpen} class="lg:hidden p-2"><Settings size={20}/></button><h1 class="text-lg font-bold uppercase">PolyField</h1></div><div class="flex gap-4 text-sm"><div class="flex items-center gap-2"><Volume2 size={14}/><span class="uppercase text-[10px]">Audio</span></div><div class="flex items-center gap-2"><div class={`w-2 h-2 rounded-full ${midiOutputs.length>0?'bg-[#00FF00]':'bg-red-500'}`}></div><span class="uppercase text-[10px]">MIDI</span></div></div></header>
<main class="flex-1 flex overflow-hidden relative">
{#if isControlsOpen || isLargeScreen}
<aside class="fixed inset-y-0 left-0 z-40 w-80 bg-[#E4E3E0] border-r border-[#141414] flex flex-col lg:static"><div class="p-4 lg:hidden border-b flex justify-between"><span class="text-xs font-bold uppercase">Settings</span><button on:click={() => isControlsOpen=false}><X size={20}/></button></div>
<div class="flex-1 overflow-y-auto p-4 space-y-6">
<section><h2 class="text-xs font-bold uppercase border-b pb-2">Harmony</h2><select class="w-full border p-2 mt-2" bind:value={state.scale}>{#each Object.keys(SCALES) as s}<option value={s}>{s}</option>{/each}</select><select class="w-full border p-2 mt-2" bind:value={state.rootNote}><option value={36}>C2 (36)</option><option value={48}>C3 (48)</option><option value={60}>C4 (60)</option></select></section>
<section><h2 class="text-xs font-bold uppercase border-b pb-2">Presets</h2><div class="flex gap-2 mt-2"><button class="flex-1 p-2 border" on:click={savePreset}><Save size={14}/> Save</button><button class="flex-1 p-2 border" on:click={loadPreset}><Download size={14}/> Load</button></div></section>
</div></aside>
{/if}
<div class="flex-1 relative bg-[#141414] p-2 lg:p-8"><div bind:this={surfaceRef} role="application" aria-label="Polyfield touch surface" tabindex="0" class="w-full h-full relative border bg-[#1A1A1A]" on:pointerdown={pointerDown} on:pointermove={pointerMove} on:pointerup={pointerUp} on:pointercancel={pointerUp}>
{#each Array.from({length: state.gridSteps}) as _, i}<div class="absolute left-0 right-0 h-px bg-white/10" style={`top:${(i/state.gridSteps)*100}%`}></div><div class="absolute top-0 bottom-0 w-px bg-white/10" style={`left:${(i/state.gridSteps)*100}%`}></div>{/each}
{#each Object.entries(pointers) as [id,p]}<div class="absolute top-0 bottom-0 bg-[#F27D26]/20" style={`left:${Math.floor(p.x*state.gridSteps)/state.gridSteps*100}%;width:${1/state.gridSteps*100}%`}></div><div class="absolute left-0 right-0 bg-[#00FF00]/20" style={`top:${Math.floor(p.y*state.gridSteps)/state.gridSteps*100}%;height:${1/state.gridSteps*100}%`}></div><div class="absolute w-6 h-6 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2" style={`left:${p.x*100}%;top:${p.y*100}%`}></div>{/each}
<div class="absolute bottom-3 left-3 flex flex-wrap gap-1">{#each Array.from(activeNotes).sort((a,b)=>a-b) as note}<div class="px-2 py-1 bg-white/10 text-white text-xs rounded">{note}</div>{/each}</div>
{#if !Object.keys(pointers).length}<div class="absolute inset-0 flex items-center justify-center text-white/20 uppercase">Touch to play</div>{/if}
{#if !isControlsOpen}<button on:click|stopPropagation={() => isControlsOpen=true} class="lg:hidden absolute top-4 left-4 p-2 bg-white/5 rounded-full text-white/50"><ChevronRight size={20}/></button>{/if}
</div></div></main></div>
