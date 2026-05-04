<script lang="ts">
  import { ChevronRight, Maximize2, Minimize2 } from 'lucide-svelte';

  export let state: { gridSteps: number };
  export let pointers: Record<string, { x: number; y: number; notes: number[] }>;
  export let activeNotes: Set<number>;
  export let isControlsOpen = false;
  export let isSurfaceFullscreen = false;
  export let onOpenControls: () => void = () => {};
  export let onToggleFullscreen: () => void = () => {};
  export let pointerDown: (e: PointerEvent) => void;
  export let pointerMove: (e: PointerEvent) => void;
  export let pointerUp: (e: PointerEvent) => void;
  export let surfaceRef: HTMLDivElement;
</script>

<div class="flex-1 relative bg-[#141414] touch-none overflow-hidden p-2 xl:p-8 flex items-center justify-center">
  <div
    bind:this={surfaceRef}
    role="application"
    aria-label="Polyfield touch surface"
    class="w-full h-full relative cursor-crosshair border border-[#333] bg-[#1A1A1A] shadow-2xl rounded-sm overflow-hidden select-none [-webkit-user-select:none] [-webkit-touch-callout:none]"
    on:pointerdown={pointerDown}
    on:pointermove={pointerMove}
    on:pointerup={pointerUp}
    on:pointercancel={pointerUp}
    on:pointerleave={pointerUp}
  >
    {#each Array.from({ length: state.gridSteps }) as _, i}
      <div class="absolute left-0 right-0 h-px bg-white/10" style={`top:${(i / state.gridSteps) * 100}%`}></div>
      <div class="absolute top-0 bottom-0 w-px bg-white/10" style={`left:${(i / state.gridSteps) * 100}%`}></div>
    {/each}

    {#each Object.entries(pointers) as [_, p]}
      <div
        class="absolute top-0 bottom-0 bg-[#F27D26]/20 border-x border-[#F27D26]/40"
        style={`left:${(Math.floor(p.x * state.gridSteps) / state.gridSteps) * 100}%;width:${(1 / state.gridSteps) * 100}%`}
      ></div>
      <div
        class="absolute left-0 right-0 bg-[#00FF00]/20 border-y border-[#00FF00]/40"
        style={`top:${(Math.floor(p.y * state.gridSteps) / state.gridSteps) * 100}%;height:${(1 / state.gridSteps) * 100}%`}
      ></div>
      <div
        class="absolute w-6 h-6 xl:w-4 xl:h-4 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"
        style={`left:${p.x * 100}%;top:${p.y * 100}%`}
      ></div>
    {/each}

    <div class="absolute bottom-3 left-3 xl:bottom-4 xl:left-4 pointer-events-none flex flex-wrap gap-1.5 xl:gap-2 max-w-[80%]">
      {#each Array.from(activeNotes).sort((a, b) => a - b) as note}
        <div class="px-1.5 py-0.5 xl:px-2 xl:py-1 bg-white/10 text-white text-[9px] xl:text-xs rounded border border-white/20">{note}</div>
      {/each}
    </div>

    {#if !Object.keys(pointers).length}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p class="text-[#E4E3E0]/20 uppercase tracking-[0.2em] text-[10px] xl:text-sm">Touch to play</p>
      </div>
    {/if}

    {#if !isControlsOpen && !isSurfaceFullscreen}
      <button
        on:click|stopPropagation={onOpenControls}
        class="xl:hidden absolute top-4 left-4 p-2 bg-white/5 border border-white/10 rounded-full text-white/50"
      >
        <ChevronRight size={20} />
      </button>
    {/if}

    <button
      on:click|stopPropagation={onToggleFullscreen}
      class="absolute top-4 right-4 p-2 bg-white/5 border border-white/10 rounded-full text-white/70"
      aria-label={isSurfaceFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      {#if isSurfaceFullscreen}
        <Minimize2 size={18} />
      {:else}
        <Maximize2 size={18} />
      {/if}
    </button>
  </div>
</div>
