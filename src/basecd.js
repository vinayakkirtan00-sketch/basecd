/**
 * BaseCD — Reference Implementation (JavaScript)
 * Version: 1.0.0
 * Specification: docs/SPECIFICATION.md
 *
 * BaseCD is a human-friendly binary-to-text encoding developed by ConvertDock.
 * It combines a Crockford-style 32-symbol alphabet with a versioned prefix
 * and an embedded CRC-8 checksum, so that transcription errors and data
 * corruption can be detected without any external metadata.
 *
 * Format:   CD1-<payload>-<checksum>
 *   CD1     literal version prefix (BaseCD, version 1)
 *   payload variable-length body, 5 bits per symbol, MSB-first
 *   checksum 2-symbol CRC-8 check value of the original input bytes
 *
 * This file has no runtime dependencies and works in Node.js and browsers.
 */

'use strict';

// -----------------------------------------------------------------------
// Alphabet
// -----------------------------------------------------------------------

/**
 * The BaseCD alphabet: 32 symbols, 0-9 and A-Z minus I, L, O, U.
 * These four letters are excluded because they are easily confused with
 * digits or with each other (I/1, L/1, O/0, U/V) when hand-transcribed.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

if (ALPHABET.length !== 32) {
  // Defensive: guarantees the 5-bit packing invariant holds.
  throw new Error('BaseCD: alphabet must contain exactly 32 symbols');
}

/** @type {Record<string, number>} symbol -> 5-bit value */
const ALPHABET_MAP = Object.create(null);
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET[i]] = i;
}

const VERSION_PREFIX = 'CD1';
const FORMAT_REGEX = /^CD1-([0-9A-HJKMNP-TV-Z]*)-([0-9A-HJKMNP-TV-Z]{2})$/;

// -----------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------

class BaseCDError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BaseCDError';
    this.code = code;
  }
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

// Reused across calls: both are stateless and safe to share, and
// avoiding per-call construction shaves overhead off hot paths that
// repeatedly encode/decode short strings.
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Normalize supported input types into a Uint8Array of bytes.
 * @param {string|Uint8Array|number[]} input
 * @returns {Uint8Array}
 */
function toBytes(input) {
  if (typeof input === 'string') {
    return textEncoder.encode(input);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++) {
      const v = input[i];
      if (!Number.isInteger(v) || v < 0 || v > 255) {
        throw new BaseCDError(
          `Invalid byte value at index ${i}: ${v} (expected integer 0-255)`,
          'INVALID_INPUT_TYPE'
        );
      }
    }
    return Uint8Array.from(input);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
    return new Uint8Array(input);
  }
  throw new BaseCDError(
    'Unsupported input type: expected string, Uint8Array, Buffer, or number[]',
    'INVALID_INPUT_TYPE'
  );
}

/**
 * Pack raw bytes into BaseCD symbols, 5 bits at a time, MSB-first.
 * Trailing partial groups are left-padded with zero bits (never
 * omitted), so encode/decode is deterministic and lossless.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function packSymbols(bytes) {
  let bitBuffer = 0;
  let bitCount = 0;

  // Pre-size the output array: ceil(bytes.length * 8 / 5) symbols.
  // Building via an indexed array + single join() avoids the O(n^2)
  // worst case that repeated string concatenation can hit on very
  // large inputs in some engines, keeping encode() linear in input size.
  const symbolCount = Math.ceil((bytes.length * 8) / 5);
  const chars = new Array(symbolCount);
  let pos = 0;

  for (let i = 0; i < bytes.length; i++) {
    bitBuffer = (bitBuffer << 8) | bytes[i];
    bitCount += 8;
    while (bitCount >= 5) {
      const index = (bitBuffer >>> (bitCount - 5)) & 0x1f;
      chars[pos++] = ALPHABET[index];
      bitCount -= 5;
    }
  }

  if (bitCount > 0) {
    const index = (bitBuffer << (5 - bitCount)) & 0x1f;
    chars[pos++] = ALPHABET[index];
  }

  return chars.join('');
}

/**
 * Unpack BaseCD symbols back into raw bytes.
 * @param {string} symbols
 * @returns {Uint8Array}
 */
function unpackSymbols(symbols) {
  let bitBuffer = 0;
  let bitCount = 0;
  const len = symbols.length;

  // Pre-size the output buffer: floor(len * 5 / 8) bytes. Writing
  // directly into a Uint8Array avoids the intermediate plain-array
  // allocation and conversion pass that Uint8Array.from() would need.
  const byteCount = Math.floor((len * 5) / 8);
  const out = new Uint8Array(byteCount);
  let pos = 0;

  for (let i = 0; i < len; i++) {
    const ch = symbols[i];
    const value = ALPHABET_MAP[ch];
    if (value === undefined) {
      throw new BaseCDError(`Invalid BaseCD symbol: "${ch}"`, 'INVALID_SYMBOL');
    }
    bitBuffer = (bitBuffer << 5) | value;
    bitCount += 5;
    if (bitCount >= 8) {
      out[pos++] = (bitBuffer >>> (bitCount - 8)) & 0xff;
      bitCount -= 8;
    }
  }

  // Any leftover bits must be zero padding, per the encoding rules.
  // Non-zero leftover bits indicate a corrupted or hand-edited string.
  if (bitCount > 0) {
    const remainder = bitBuffer & ((1 << bitCount) - 1);
    if (remainder !== 0) {
      throw new BaseCDError(
        'Invalid padding bits: BaseCD payload is malformed',
        'INVALID_PADDING'
      );
    }
  }

  return out;
}

/**
 * Compute CRC-8 (polynomial 0x07, the CRC-8-CCITT/ATM polynomial)
 * over the given bytes. Used as the embedded BaseCD checksum.
 * @param {Uint8Array} bytes
 * @returns {number} an 8-bit unsigned integer
 */
function crc8(bytes) {
  let crc = 0x00;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

/**
 * Encode a single checksum byte as its fixed 2-symbol BaseCD form.
 * @param {number} byte
 * @returns {string}
 */
function encodeChecksum(byte) {
  return packSymbols(Uint8Array.of(byte));
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Encode data into a BaseCD string.
 * @param {string|Uint8Array|Buffer|number[]} input
 * @returns {string} a string of the form "CD1-<payload>-<checksum>"
 */
function encode(input) {
  const bytes = toBytes(input);
  const payload = packSymbols(bytes);
  const checksum = encodeChecksum(crc8(bytes));
  return `${VERSION_PREFIX}-${payload}-${checksum}`;
}

/**
 * Decode a BaseCD string back into its original bytes.
 * Throws BaseCDError if the string is malformed or the checksum fails.
 * @param {string} basecdString
 * @returns {Uint8Array}
 */
function decode(basecdString) {
  if (typeof basecdString !== 'string') {
    throw new BaseCDError('BaseCD input must be a string', 'INVALID_INPUT_TYPE');
  }

  const normalized = basecdString.trim().toUpperCase();
  const match = FORMAT_REGEX.exec(normalized);
  if (!match) {
    throw new BaseCDError(
      'Malformed BaseCD string: expected format "CD1-<payload>-<checksum>"',
      'MALFORMED_STRING'
    );
  }

  const [, payload, checksum] = match;
  const bytes = unpackSymbols(payload);
  const expectedChecksum = encodeChecksum(crc8(bytes));

  if (checksum !== expectedChecksum) {
    throw new BaseCDError(
      'Checksum mismatch: BaseCD string is corrupted or was altered',
      'CHECKSUM_MISMATCH'
    );
  }

  return bytes;
}

/**
 * Decode a BaseCD string into a UTF-8 string. Convenience wrapper
 * around decode() for the common case of round-tripping text.
 * @param {string} basecdString
 * @returns {string}
 */
function decodeToString(basecdString) {
  return textDecoder.decode(decode(basecdString));
}

/**
 * Validate whether a string is syntactically well-formed BaseCD,
 * WITHOUT verifying the checksum. Useful for cheap input filtering
 * (e.g. form validation) before committing to a full decode.
 * @param {string} basecdString
 * @returns {boolean}
 */
function validate(basecdString) {
  if (typeof basecdString !== 'string') return false;
  const normalized = basecdString.trim().toUpperCase();
  const match = FORMAT_REGEX.exec(normalized);
  if (!match) return false;

  try {
    unpackSymbols(match[1]);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Verify that a BaseCD string's embedded checksum matches its payload.
 * Returns false rather than throwing, for use in guard clauses.
 * @param {string} basecdString
 * @returns {boolean}
 */
function verifyChecksum(basecdString) {
  try {
    decode(basecdString);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  encode,
  decode,
  decodeToString,
  validate,
  verifyChecksum,
  BaseCDError,
  ALPHABET,
  VERSION_PREFIX,
  // Exposed for testing and advanced use only; not part of the
  // stable public API and may change without a semver-major bump.
  _internal: { packSymbols, unpackSymbols, crc8 },
};
