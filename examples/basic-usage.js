/**
 * BaseCD — Basic Usage Example
 *
 * Run with: node examples/basic-usage.js
 */

'use strict';

const { encode, decode, decodeToString, validate, verifyChecksum } = require('../src/basecd');

console.log('=== BaseCD Basic Usage ===\n');

// 1. Encoding a string
const text = 'Hello, World!';
const encoded = encode(text);
console.log(`encode(${JSON.stringify(text)})`);
console.log(`  => ${encoded}\n`);

// 2. Decoding back to a string
const decodedText = decodeToString(encoded);
console.log(`decodeToString(${JSON.stringify(encoded)})`);
console.log(`  => ${JSON.stringify(decodedText)}\n`);

// 3. Encoding binary data
const bytes = new Uint8Array([0, 255, 128, 64, 32]);
const encodedBytes = encode(bytes);
console.log(`encode(Uint8Array [${bytes.join(', ')}])`);
console.log(`  => ${encodedBytes}\n`);

const decodedBytes = decode(encodedBytes);
console.log(`decode(${JSON.stringify(encodedBytes)})`);
console.log(`  => Uint8Array [${Array.from(decodedBytes).join(', ')}]\n`);

// 4. Structural validation (fast, no integrity check)
console.log('--- validate() vs verifyChecksum() ---');
console.log(`validate(${JSON.stringify(encoded)})        => ${validate(encoded)}`);
console.log(`verifyChecksum(${JSON.stringify(encoded)})  => ${verifyChecksum(encoded)}\n`);

// 5. Detecting a corrupted string
const corrupted = encoded.slice(0, -1) + (encoded.endsWith('0') ? '1' : '0');
console.log(`A single altered character: ${corrupted}`);
console.log(`  validate()       => ${validate(corrupted)}  (still structurally well-formed)`);
console.log(`  verifyChecksum() => ${verifyChecksum(corrupted)}  (checksum catches the corruption)\n`);

// 6. Round-tripping Unicode text
const unicode = '日本語 🚀 emoji test';
const encodedUnicode = encode(unicode);
const decodedUnicode = decodeToString(encodedUnicode);
console.log(`Unicode round-trip: ${JSON.stringify(unicode)}`);
console.log(`  encoded => ${encodedUnicode}`);
console.log(`  decoded => ${JSON.stringify(decodedUnicode)}`);
console.log(`  match   => ${unicode === decodedUnicode}`);
