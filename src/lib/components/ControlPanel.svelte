<script lang="ts">
  import { X, Save, Download } from 'lucide-svelte';
  import { SCALES } from '$lib/audio/engine';
  import type { AppState, Waveform } from '$lib/types';

  export let state: AppState;
  export let selectedMidiOut = '';
  export let midiOutputs: { id: string; name: string | null }[] = [];
  export let mobile = false;
  export let onClose: () => void = () => {};
</script>

<aside class="fixed inset-y-0 left-0 z-40 w-80 bg-[#E4E3E0] border-r border-[#141414] flex flex-col xl:static xl:z-0 xl:block">
  {#if mobile}
    <div class="p-4 xl:hidden border-b border-[#141414] flex justify-between items-center bg-[#D4D3D0]">
<span class="text-xs font-bold uppercase tracking-widest">Settings</span>
<button on:click={onClose}>
<X size={20}/>
</button>
</div>
  {/if}
  <div class="flex-1 overflow-y-auto overscroll-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch] pt-8 p-6 space-y-8 pb-24 xl:pt-10 xl:pb-8">
    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Harmony</h2>
<select class="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase" bind:value={state.scale}>{#each Object.keys(SCALES) as s}<option value={s}>{s}</option>{/each}</select>
<select class="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase" bind:value={state.rootNote}>
<option value={36}>C2 (36)</option>
<option value={48}>C3 (48)</option>
<option value={60}>C4 (60)</option>
</select>
</section>
    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Voices</h2>
<div class="grid grid-cols-2 gap-4">{#each [0,1,2,3] as i}<div class="space-y-2">
<button class={`w-full p-2 text-xs uppercase border border-[#141414] ${state.voicesActive[i] ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-transparent'}`} on:click={() => { const v=[...state.voicesActive] as [boolean,boolean,boolean,boolean]; v[i]=!v[i]; state={...state, voicesActive:v}; }}>V{i+1}</button>
<div class="flex items-center justify-between text-[10px]">
<span class="opacity-50">INT</span>
<input type="number" class="w-10 bg-transparent border-b border-[#141414] text-right focus:outline-none" value={state.intervals[i]} on:change={(e) => { const ints=[...state.intervals] as [number,number,number,number]; ints[i]=parseInt((e.currentTarget as HTMLInputElement).value)||0; state={...state, intervals:ints}; }} />
</div>
</div>{/each}</div>
</section>
    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Internal Synth</h2>
<div class="flex gap-1">{#each ['sine','square','sawtooth','triangle'] as wf}<button class={`flex-1 p-1.5 text-[9px] uppercase border border-[#141414] ${state.waveform===wf?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state, waveform:wf as Waveform}}>{wf.slice(0,3)}</button>{/each}</div>
<div class="space-y-2">
<div class="flex justify-between items-center">
<span class="text-xs uppercase opacity-70">Delay</span>
<button class={`px-3 py-1 text-[10px] uppercase border border-[#141414] ${state.delayEnabled ? 'bg-[#141414] text-[#E4E3E0]' : ''}`} on:click={() => state={...state, delayEnabled:!state.delayEnabled}}>{state.delayEnabled ? 'ON' : 'OFF'}</button>
</div>{#if state.delayEnabled}<div class="flex items-center gap-2">
<span class="text-[10px] opacity-50 uppercase">Mix</span>
<input type="range" min="0" max="1" step="0.01" class="flex-1 accent-[#141414]" bind:value={state.delayMix} />
<span class="text-[10px] opacity-50 w-8 text-right">{Math.round(state.delayMix*100)}%</span>
</div>{/if}</div>
</section>
    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">MIDI Out</h2>
<select class="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase" bind:value={selectedMidiOut}>
<option value="">None</option>{#each midiOutputs as out}<option value={out.id}>{out.name}</option>{/each}</select>
<div class="flex gap-4">
<div class="flex-1">
<span class="text-xs uppercase opacity-70">Ch</span>
<select class="w-full bg-transparent border border-[#141414] p-2 text-sm uppercase" bind:value={state.midiChannel} disabled={state.mpeEnabled}>{#each Array.from({length:16}) as _,i}<option value={i+1}>{i+1}</option>{/each}</select>
</div>
<div class="flex-1">
<span class="text-xs uppercase opacity-70">MPE</span>
<button class={`w-full p-2 text-sm uppercase border border-[#141414] ${state.mpeEnabled ? 'bg-[#141414] text-[#E4E3E0]' : ''}`} on:click={() => state={...state,mpeEnabled:!state.mpeEnabled}}>{state.mpeEnabled ? 'ON' : 'OFF'}</button>
</div>
</div>
</section>
    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Motion</h2>
<div class="space-y-2">
<span class="text-xs uppercase opacity-70">Touch Mode</span>
<div class="flex gap-2">
<button class={`flex-1 p-2 text-xs uppercase border border-[#141414] ${state.touchMode==='mono'?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state,touchMode:'mono'}}>Mono</button>
<button class={`flex-1 p-2 text-xs uppercase border border-[#141414] ${state.touchMode==='poly'?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state,touchMode:'poly'}}>Poly</button>
</div>
</div>
<div class="space-y-2">
<span class="text-xs uppercase opacity-70">Play Mode</span>
<div class="flex gap-2">
<button class={`flex-1 p-2 text-xs uppercase border border-[#141414] ${state.motionMode==='free'?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state,motionMode:'free'}}>Free</button>
<button class={`flex-1 p-2 text-xs uppercase border border-[#141414] ${state.motionMode==='arp'?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state,motionMode:'arp'}}>Arp</button>
</div>
</div>
<div class="flex gap-1">
<button class={`flex-1 p-1.5 text-[9px] uppercase border border-[#141414] ${state.clockSource==='internal'?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state,clockSource:'internal'}}>INT</button>
<button class={`flex-1 p-1.5 text-[9px] uppercase border border-[#141414] ${state.clockSource==='external'?'bg-[#141414] text-[#E4E3E0]':''}`} on:click={() => state={...state,clockSource:'external'}}>EXT</button>
</div>{#if state.clockSource==='internal'}<div class="flex items-center justify-between text-xs">
<span class="opacity-70 uppercase">BPM</span>
<input type="number" class="w-12 bg-transparent border-b border-[#141414] text-right focus:outline-none" value={state.bpm} min="30" max="300" on:change={(e) => state={...state,bpm:parseInt((e.currentTarget as HTMLInputElement).value)||120}} />
</div>{/if}</section>

    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Debug</h2>
<div class="flex justify-between items-center">
<span class="text-xs uppercase opacity-70">Oscilloscope</span>
<button class={`px-3 py-1 text-[10px] uppercase border border-[#141414] ${state.showOscilloscope ? 'bg-[#141414] text-[#E4E3E0]' : ''}`} on:click={() => state={...state, showOscilloscope:!state.showOscilloscope}}>{state.showOscilloscope ? 'ON' : 'OFF'}</button>
</div>
</section>
    <section class="space-y-4">
<h2 class="text-xs font-bold uppercase tracking-widest border-b border-[#141414] pb-2">Presets</h2>
<div class="flex gap-2">
<button class="flex-1 p-2 text-xs uppercase border border-[#141414] flex items-center justify-center gap-2" on:click={() => localStorage.setItem('polyfield_preset',JSON.stringify(state))}>
<Save size={14}/> Save</button>
<button class="flex-1 p-2 text-xs uppercase border border-[#141414] flex items-center justify-center gap-2" on:click={() => { const s=localStorage.getItem('polyfield_preset'); if(s) state=JSON.parse(s); }}>
<Download size={14}/> Load</button>
</div>
</section>
  </div>
</aside>
