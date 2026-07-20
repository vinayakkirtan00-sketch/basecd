/**
 * BaseCD — File Encoding Example
 *
 * Demonstrates encoding raw binary file contents (e.g. for embedding
 * small files in text-only transport such as JSON, URLs, or QR codes)
 * and decoding them back to their original bytes.
 *
 * Run with: node examples/file-encoding.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { encode, decode } = require('../src/basecd');

console.log('=== BaseCD File Encoding ===\n');

// Create a small temporary binary file to demonstrate with, so this
// example is runnable standalone without any fixture files.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'basecd-example-'));
const filePath = path.join(tmpDir, 'sample.bin');

// A small synthetic "binary" payload: not valid UTF-8, includes the
// full byte range, to prove BaseCD is not text-only.
const original = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x7f, 0x80, 0x42, 0x13, 0x37]);
fs.writeFileSync(filePath, original);

console.log(`Wrote ${original.length}-byte sample file to: ${filePath}`);
console.log(`Original bytes: [${Array.from(original).join(', ')}]\n`);

// Read the file and encode its raw bytes
const fileBytes = fs.readFileSync(filePath);
const encoded = encode(fileBytes);
console.log(`Encoded (BaseCD): ${encoded}`);
console.log(`Encoded length: ${encoded.length} characters (original: ${fileBytes.length} bytes)\n`);

// Decode back and write to a new file, then verify byte-for-byte equality
const decoded = decode(encoded);
const outputPath = path.join(tmpDir, 'sample-decoded.bin');
fs.writeFileSync(outputPath, Buffer.from(decoded));

const roundTripMatches = Buffer.compare(original, Buffer.from(decoded)) === 0;
console.log(`Decoded and wrote to: ${outputPath}`);
console.log(`Byte-for-byte match with original: ${roundTripMatches}`);

// Clean up the temporary directory
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('\nCleaned up temporary files.');
