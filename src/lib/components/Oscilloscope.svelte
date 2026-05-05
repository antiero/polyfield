<script lang="ts">
  import { onDestroy } from 'svelte';

  export let analyser: AnalyserNode | null = null;
  export let width = 220;
  export let height = 56;

  let canvas: HTMLCanvasElement;
  let frame = 0;
  let data = new Uint8Array(2048);

  const draw = () => {
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (data.length !== analyser.fftSize) {
      data = new Uint8Array(analyser.fftSize);
    }

    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const step = data.length / width;
    for (let x = 0; x < width; x++) {
      const sample = data[Math.floor(x * step)] / 255;
      const y = sample * height;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    frame = requestAnimationFrame(draw);
  };

  $: {
    if (frame) cancelAnimationFrame(frame);
    if (analyser) frame = requestAnimationFrame(draw);
  }

  onDestroy(() => {
    if (frame) cancelAnimationFrame(frame);
  });
</script>

<canvas bind:this={canvas} {width} {height} class="w-full h-full rounded border border-[#141414]/40 bg-[#E4E3E0]/70" />
