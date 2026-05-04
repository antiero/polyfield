<script lang="ts">
  import { Settings, Volume2 } from 'lucide-svelte';
  export let midiConnected = false;
  export let onToggleControls: () => void;
</script>
<header class="p-3 xl:p-4 border-b border-[#141414] flex justify-between items-center bg-[#E4E3E0] z-30 shrink-0">
  <div class="flex items-center gap-3 xl:gap-4">
    <button on:click={onToggleControls} class="xl:hidden p-2 -ml-2"><Settings size={20}/></button>
    <h1 class="text-lg xl:text-xl font-bold tracking-tighter uppercase">PolyField</h1>
    <span class="text-[10px] opacity-50 uppercase tracking-widest hidden sm:inline-block">Harmonic Performance</span>
  </div>
  <div class="flex items-center gap-3 xl:gap-4 text-sm"><div class="flex items-center gap-1.5 xl:gap-2"><Volume2 size={14}/><span class="uppercase text-[10px] xl:text-xs">Audio</span></div><div class="flex items-center gap-1.5 xl:gap-2"><div class={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${midiConnected ? 'bg-[#00FF00]' : 'bg-red-500'}`}></div><span class="uppercase text-[10px] xl:text-xs">MIDI</span></div></div>
</header>
