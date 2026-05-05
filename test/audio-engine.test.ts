import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/lib/audio/engine';

class MockNode {
  connections: MockNode[] = [];
  connect(node: MockNode) { this.connections.push(node); return node; }
  disconnect() {}
}

class MockGain extends MockNode { gain = { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }; }
class MockDelay extends MockNode { delayTime = { value: 0 }; }
class MockFilter extends MockNode { type: BiquadFilterType = 'lowpass'; frequency = { value: 0 }; Q = { value: 0 }; }
class MockCompressor extends MockNode { threshold = { value: 0 }; knee = { value: 0 }; ratio = { value: 0 }; attack = { value: 0 }; release = { value: 0 }; }
class MockAnalyser extends MockNode { fftSize = 0; smoothingTimeConstant = 0; getByteTimeDomainData() {} }
class MockOsc extends MockNode { type: OscillatorType = 'sine'; frequency={value:0}; start(){} stop(){} }

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = new MockNode();
  createGain() { return new MockGain() as unknown as GainNode; }
  createDelay() { return new MockDelay() as unknown as DelayNode; }
  createBiquadFilter() { return new MockFilter() as unknown as BiquadFilterNode; }
  createDynamicsCompressor() { return new MockCompressor() as unknown as DynamicsCompressorNode; }
  createAnalyser() { return new MockAnalyser() as unknown as AnalyserNode; }
  createOscillator() { return new MockOsc() as unknown as OscillatorNode; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

test('AudioEngine initializes and routes to destination through output tap/analyser', () => {
  (globalThis as any).window = { AudioContext: MockAudioContext };
  const engine = new AudioEngine();
  engine.init();
  assert.ok(engine.ctx);
  assert.ok(engine.getAnalyser());
  assert.equal(engine.ctx?.state, 'running');
  assert.ok(engine.outputTap);
});

test('AudioEngine supports webkitAudioContext fallback', () => {
  (globalThis as any).window = { webkitAudioContext: MockAudioContext };
  const engine = new AudioEngine();
  engine.init();
  assert.ok(engine.ctx);
});
