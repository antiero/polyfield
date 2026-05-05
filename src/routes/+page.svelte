<script lang="ts">
import { onMount } from 'svelte';
import ControlPanel from '$lib/components/ControlPanel.svelte';
import TouchSurface from '$lib/components/TouchSurface.svelte';
import PolyfieldHeader from '$lib/components/PolyfieldHeader.svelte';
import { audio, midi, getNoteInScale } from '$lib/audio/engine';
import type { AppState } from '$lib/types';

const INITIAL_STATE: AppState = { scale: 'PentatonicMinor', rootNote: 48, voicesActive: [true,true,true,false], intervals: [0,2,0,2], waveform: 'sawtooth', gridSteps: 21, motionMode: 'free', bpm: 120, clockSource: 'internal', mpeEnabled: false, midiChannel: 1, touchMode: 'mono', delayEnabled: true, delayMix: 0.5 };
let state: AppState = { ...INITIAL_STATE };
let pointerNotes = new Set<number>(), midiNotes = new Set<number>();
let pointers: Record<number,{x:number;y:number;notes:number[]}> = {};
let midiOutputs:{id:string;name:string|null}[] = []; let selectedMidiOut='';
let isControlsOpen = false, isDesktopLayout = true; let surfaceRef: HTMLDivElement;
let tickCount = 0; let timer: ReturnType<typeof setInterval> | null = null; let arpIndex=0;

$: activeNotes = new Set([...pointerNotes, ...midiNotes]);
$: allHeldNotes = Array.from(new Set(Object.values(pointers).flatMap((p) => p.notes))).sort((a,b)=>a-b);
$: midi.mpeEnabled = state.mpeEnabled;
$: midi.midiChannel = state.midiChannel;
$: audio.setWaveform(state.waveform);
$: audio.setDelay(state.delayEnabled, state.delayMix);
$: if (selectedMidiOut) midi.setOutput(selectedMidiOut);

const calculateNotes=(x:number,y:number)=>{ const degreeX=Math.floor(x*state.gridSteps), degreeY=Math.floor((1-y)*state.gridSteps); const notes=new Set<number>(); if(state.voicesActive[0])notes.add(getNoteInScale(state.scale,state.rootNote,degreeX+state.intervals[0])); if(state.voicesActive[1])notes.add(getNoteInScale(state.scale,state.rootNote,degreeX+state.intervals[1])); if(state.voicesActive[2])notes.add(getNoteInScale(state.scale,state.rootNote-12,degreeY+state.intervals[2])); if(state.voicesActive[3])notes.add(getNoteInScale(state.scale,state.rootNote-12,degreeY+state.intervals[3])); return Array.from(notes).sort((a,b)=>a-b); };

function syncFree(){ if(state.motionMode!=='free') return; const next = new Set(allHeldNotes); for(const n of pointerNotes) if(!next.has(n)&&!midiNotes.has(n)){audio.stopNote(n);midi.stopNote(n);} for(const n of next) if(!pointerNotes.has(n)&&!midiNotes.has(n)){audio.playNote(n);midi.playNote(n);} pointerNotes = next; }
function stepArp(){ if(state.motionMode!=='arp'||allHeldNotes.length===0) return; const note = allHeldNotes[arpIndex%allHeldNotes.length]; for(const n of pointerNotes) if(!midiNotes.has(n)&&n!==note){audio.stopNote(n);midi.stopNote(n);} if(!midiNotes.has(note)){audio.playNote(note);midi.playNote(note);} pointerNotes=new Set([note]); arpIndex++; }
function resetArpIfEmpty(){ if(state.motionMode==='arp'&&allHeldNotes.length===0){ for(const n of pointerNotes) if(!midiNotes.has(n)){audio.stopNote(n);midi.stopNote(n);} pointerNotes=new Set(); arpIndex=0; } }
$: { syncFree(); resetArpIfEmpty(); }

function setupClock(){ if(timer) clearInterval(timer); midi.onClockTick=null; midi.onStart=null; midi.onStop=null; tickCount=0; if(state.clockSource==='internal'){ const tickMs = 60000/state.bpm/24; timer = setInterval(()=>{ midi.sendClock(); if(tickCount%6===0) stepArp(); tickCount++; }, tickMs); } else { midi.onClockTick=()=>{ if(tickCount%6===0) stepArp(); tickCount++; }; midi.onStart=()=>{tickCount=0; arpIndex=0;}; midi.onStop=()=>{tickCount=0;}; } }
$: if (state.clockSource || state.bpm) setupClock();



function pointerDown(e: PointerEvent){ audio.init(); surfaceRef.setPointerCapture(e.pointerId); const r=surfaceRef.getBoundingClientRect(); const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)); const notes=calculateNotes(x,y); pointers = state.touchMode==='mono' ? {[e.pointerId]:{x,y,notes}} : {...pointers,[e.pointerId]:{x,y,notes}}; }
function pointerMove(e: PointerEvent){ if(!pointers[e.pointerId]) return; const r=surfaceRef.getBoundingClientRect(); const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)); pointers={...pointers,[e.pointerId]:{x,y,notes:calculateNotes(x,y)}}; }
function pointerUp(e: PointerEvent){ const n={...pointers}; delete n[e.pointerId]; pointers=n; if(surfaceRef?.hasPointerCapture(e.pointerId)) surfaceRef.releasePointerCapture(e.pointerId); }

onMount(() => { isDesktopLayout = window.innerWidth >= 1280; const resize=()=>{ isDesktopLayout=window.innerWidth>=1280; if(isDesktopLayout) isControlsOpen=false; }; window.addEventListener('resize',resize); void midi.init().then(() => { midiOutputs=midi.getOutputs(); if(midiOutputs[0]) selectedMidiOut=midiOutputs[0].id; }); midi.onNoteOn=(note,velocity)=>{ audio.init(); audio.playNote(note,velocity); midiNotes = new Set(midiNotes).add(note); }; midi.onNoteOff=(note)=>{ audio.stopNote(note); const n=new Set(midiNotes); n.delete(note); midiNotes=n; }; setupClock(); return ()=>{ window.removeEventListener('resize',resize); if(timer) clearInterval(timer); }; });
</script>

<div class="h-dvh min-h-screen bg-[#E4E3E0] text-[#141414] font-mono flex flex-col selection:bg-[#F27D26] selection:text-white overflow-hidden">
<PolyfieldHeader midiConnected={midiOutputs.length > 0} onToggleControls={() => isControlsOpen = !isControlsOpen} />
<main class="flex-1 flex overflow-hidden relative">
{#if isControlsOpen || isDesktopLayout}
<ControlPanel bind:state bind:selectedMidiOut {midiOutputs} mobile={!isDesktopLayout} onClose={() => isControlsOpen = false} />{/if}
<TouchSurface {state} pointers={pointers as any} {activeNotes} {isControlsOpen} onOpenControls={() => isControlsOpen=true} {pointerDown} {pointerMove} {pointerUp} bind:surfaceRef />
</main></div>
