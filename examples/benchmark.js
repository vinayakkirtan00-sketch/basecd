/**
 * BaseCD — Throughput Benchmark
 *
 * Rough, single-machine throughput numbers for encode()/decode() across
 * a range of payload sizes. Not a substitute for profiling in your own
 * environment, but useful as a sanity check on the O(n) claims in
 * docs/SPECIFICATION.md §12.
 *
 * Run with: node examples/benchmark.js
 */

'use strict';

const { encode, decode } = require('../src/basecd');

function randomBytes(n) {
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

function benchmark(label, sizeBytes, iterations) {
  const data = randomBytes(sizeBytes);

  const encodeStart = process.hrtime.bigint();
  let encoded;
  for (let i = 0; i < iterations; i++) {
    encoded = encode(data);
  }
  const encodeEnd = process.hrtime.bigint();

  const decodeStart = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    decode(encoded);
  }
  const decodeEnd = process.hrtime.bigint();

  const encodeMs = Number(encodeEnd - encodeStart) / 1e6;
  const decodeMs = Number(decodeEnd - decodeStart) / 1e6;
  const totalBytes = sizeBytes * iterations;

  const encodeMBps = (totalBytes / (encodeMs / 1000)) / (1024 * 1024);
  const decodeMBps = (totalBytes / (decodeMs / 1000)) / (1024 * 1024);

  console.log(
    `${label.padEnd(12)} | ` +
    `encode: ${encodeMs.toFixed(2).padStart(9)} ms (${encodeMBps.toFixed(1).padStart(7)} MB/s) | ` +
    `decode: ${decodeMs.toFixed(2).padStart(9)} ms (${decodeMBps.toFixed(1).padStart(7)} MB/s)`
  );
}

console.log('=== BaseCD Throughput Benchmark ===\n');
console.log('Payload size  | Encode time (throughput)          | Decode time (throughput)');
console.log('-'.repeat(90));

benchmark('64 B', 64, 20000);
benchmark('1 KB', 1024, 5000);
benchmark('64 KB', 64 * 1024, 200);
benchmark('1 MB', 1024 * 1024, 20);

console.log('\nNote: results vary by machine and Node.js version. This script exists');
console.log('to demonstrate that encode/decode scale linearly with input size, not');
console.log('to provide portable absolute numbers.');
