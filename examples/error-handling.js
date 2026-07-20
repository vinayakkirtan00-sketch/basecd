/**
 * BaseCD — Error Handling Example
 *
 * Demonstrates every BaseCDError code and how to handle each one.
 * See docs/SPECIFICATION.md §10 for the full error code reference.
 *
 * Run with: node examples/error-handling.js
 */

'use strict';

const { encode, decode, BaseCDError } = require('../src/basecd');

console.log('=== BaseCD Error Handling ===\n');

/**
 * Runs a decode attempt and reports the outcome, including the
 * specific BaseCDError code when one is thrown.
 */
function attempt(label, fn) {
  console.log(`--- ${label} ---`);
  try {
    const result = fn();
    console.log(`  Success:`, result);
  } catch (err) {
    if (err instanceof BaseCDError) {
      console.log(`  BaseCDError [${err.code}]: ${err.message}`);
    } else {
      console.log(`  Unexpected error: ${err.message}`);
      throw err;
    }
  }
  console.log();
}

// MALFORMED_STRING: doesn't match the CD1-<payload>-<checksum> pattern
attempt('Malformed string (no BaseCD structure)', () => decode('not-a-basecd-string'));

// MALFORMED_STRING: wrong version prefix
attempt('Wrong version prefix', () => decode('CD9-CSQPYRK1E8-18'));

// MALFORMED_STRING: invalid characters in payload (I, L, O, U not in alphabet)
attempt('Invalid alphabet characters', () => decode('CD1-ILOU123-AB'));

// CHECKSUM_MISMATCH: well-formed, but payload was altered after encoding
attempt('Checksum mismatch (tampered payload)', () => {
  const valid = encode('trust me');
  const [prefix, payload, checksum] = valid.split('-');
  const tamperedChar = payload[0] === '0' ? '1' : '0';
  const tampered = `${prefix}-${tamperedChar}${payload.slice(1)}-${checksum}`;
  return decode(tampered);
});

// INVALID_INPUT_TYPE: decode() requires a string
attempt('Non-string input to decode()', () => decode(12345));

// A successful decode, for contrast
attempt('Valid, untampered string', () => decode(encode('all good here')));

// Recommended pattern: branch on err.code for programmatic handling
console.log('--- Recommended handling pattern ---');
function safeDecode(basecdString) {
  try {
    return { ok: true, data: decode(basecdString) };
  } catch (err) {
    if (err instanceof BaseCDError) {
      switch (err.code) {
        case 'CHECKSUM_MISMATCH':
          return { ok: false, reason: 'Data appears corrupted or was mistyped.' };
        case 'MALFORMED_STRING':
        case 'INVALID_SYMBOL':
        case 'INVALID_PADDING':
          return { ok: false, reason: 'Not a valid BaseCD string.' };
        case 'INVALID_INPUT_TYPE':
          return { ok: false, reason: 'Input must be a string.' };
        default:
          return { ok: false, reason: 'Unknown BaseCD error.' };
      }
    }
    throw err; // re-throw anything that isn't a BaseCDError
  }
}

console.log(safeDecode('garbage'));
console.log(safeDecode(encode('clean input')));
