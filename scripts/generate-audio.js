import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22050;
const seconds = 24;
const frames = sampleRate * seconds;
const dataSize = frames * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
const notes = [110, 138.59, 164.81, 207.65, 185, 138.59];
for (let i = 0; i < frames; i += 1) {
  const t = i / sampleRate;
  const note = notes[Math.floor(t / 4) % notes.length];
  const pulse = Math.sin(2 * Math.PI * note * t) * 0.35 + Math.sin(2 * Math.PI * note * 2.01 * t) * 0.12;
  const shimmer = Math.sin(2 * Math.PI * (note * 3) * t) * 0.05 * (0.5 + 0.5 * Math.sin(t * 0.7));
  const fade = Math.min(1, t * 2, (seconds - t) * 1.5);
  buffer.writeInt16LE(Math.max(-32767, Math.min(32767, (pulse + shimmer) * fade * 17000)), 44 + i * 2);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'echo-preview.wav'), buffer);
console.log('Generated public/audio/echo-preview.wav');
