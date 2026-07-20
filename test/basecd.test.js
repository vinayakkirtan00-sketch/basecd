'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const {
  encode,
  decode,
  decodeToString,
  validate,
  verifyChecksum,
  BaseCDError,
  ALPHABET,
} = require('../src/basecd');

describe('alphabet', () => {
  test('contains exactly 32 unique symbols', () => {
    assert.equal(ALPHABET.length, 32);
    assert.equal(new Set(ALPHABET.split('')).size, 32);
  });

  test('excludes ambiguous letters I, L, O, U', () => {
    for (const ch of ['I', 'L', 'O', 'U']) {
      assert.ok(!ALPHABET.includes(ch), `alphabet should not include ${ch}`);
    }
  });
});

describe('encode / decode round trip', () => {
  const cases = [
    '',
    'a',
    'Hello, BaseCD!',
    'The quick brown fox jumps over the lazy dog.',
    '0123456789',
    'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
    '日本語のテスト', // Japanese, multi-byte UTF-8
    'こんにちは世界', // Japanese ("Hello world")
    'नमस्ते दुनिया', // Hindi (Devanagari script), multi-byte UTF-8
    'मुझे हिन्दी पसंद है', // Hindi, longer sentence
    '🚀🔥✅', // emoji, multi-byte UTF-8
    '👨‍👩‍👧‍👦', // emoji with ZWJ (zero-width joiner) sequence
    '🏳️‍🌈', // flag emoji with variation selector + ZWJ
    'a'.repeat(1000), // long text input
    'The quick brown fox jumps over the lazy dog. '.repeat(200), // long, repeated text
  ];

  for (const input of cases) {
    test(`round-trips: ${JSON.stringify(input).slice(0, 40)}`, () => {
      const encoded = encode(input);
      const decoded = decodeToString(encoded);
      assert.equal(decoded, input);
    });
  }

  test('round-trips arbitrary binary data at every byte-length 0-16', () => {
    for (let len = 0; len <= 16; len++) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 5) % 256);
      const encoded = encode(bytes);
      const decoded = decode(encoded);
      assert.deepEqual(decoded, bytes);
    }
  });

  test('round-trips a Buffer', () => {
    const buf = Buffer.from('buffer input test', 'utf8');
    const decoded = decode(encode(buf));
    assert.equal(Buffer.from(decoded).toString('utf8'), 'buffer input test');
  });

  test('round-trips a plain byte array', () => {
    const arr = [1, 2, 3, 254, 255, 0];
    const decoded = decode(encode(arr));
    assert.deepEqual(Array.from(decoded), arr);
  });
});

describe('Unicode handling', () => {
  test('empty string round-trips to an empty payload', () => {
    const encoded = encode('');
    assert.equal(decodeToString(encoded), '');
    assert.equal(encoded.split('-')[1], '');
  });

  test('round-trips emoji (multi-byte UTF-8 astral characters)', () => {
    const input = '🚀🔥✅🎉😀';
    assert.equal(decodeToString(encode(input)), input);
  });

  test('round-trips emoji with ZWJ (zero-width joiner) sequences', () => {
    const input = '👨‍👩‍👧‍👦'; // family emoji, built from 4 codepoints + ZWJs
    assert.equal(decodeToString(encode(input)), input);
  });

  test('round-trips Hindi text (Devanagari script)', () => {
    const input = 'नमस्ते, आप कैसे हैं?';
    assert.equal(decodeToString(encode(input)), input);
  });

  test('round-trips Japanese text (mixed hiragana/katakana/kanji)', () => {
    const input = '日本語のテストです。こんにちは！';
    assert.equal(decodeToString(encode(input)), input);
  });

  test('round-trips a long Unicode string mixing scripts and emoji', () => {
    const input = 'Hello 你好 नमस्ते こんにちは 🌍🚀 '.repeat(50);
    assert.equal(decodeToString(encode(input)), input);
  });

  test('round-trips embedded null bytes and control characters', () => {
    const input = 'a\u0000b\u0001c\u001fend';
    assert.equal(decodeToString(encode(input)), input);
  });
});

describe('format', () => {
  test('always starts with the CD1- prefix', () => {
    assert.match(encode('anything'), /^CD1-/);
  });

  test('always has exactly two dash-separated payload/checksum segments', () => {
    const parts = encode('formatting test').split('-');
    assert.equal(parts.length, 3);
    assert.equal(parts[0], 'CD1');
  });

  test('checksum segment is always exactly 2 symbols', () => {
    for (const input of ['', 'x', 'xy', 'longer input string here']) {
      const checksum = encode(input).split('-')[2];
      assert.equal(checksum.length, 2);
    }
  });

  test('empty input produces an empty payload segment', () => {
    const [, payload] = encode('').split('-');
    assert.equal(payload, '');
  });
});

describe('validate()', () => {
  test('returns true for well-formed strings', () => {
    assert.equal(validate(encode('valid')), true);
  });

  test('returns false for missing prefix', () => {
    assert.equal(validate('XX1-ABCDE-FG'), false);
  });

  test('returns false for wrong version', () => {
    assert.equal(validate('CD2-ABCDE-FG'), false);
  });

  test('returns false for non-string input', () => {
    assert.equal(validate(12345), false);
    assert.equal(validate(null), false);
    assert.equal(validate(undefined), false);
  });

  test('returns false for invalid characters', () => {
    assert.equal(validate('CD1-ABCDEIL-FG'), false); // I and L are not in the alphabet
  });

  test('is case-insensitive', () => {
    const encoded = encode('case test');
    assert.equal(validate(encoded.toLowerCase()), true);
  });

  test('does NOT catch checksum mismatches (by design)', () => {
    const encoded = encode('checksum bypass test');
    const tampered = encoded.slice(0, -1) + (encoded.endsWith('0') ? '1' : '0');
    // validate() only checks structure, not integrity
    assert.equal(validate(tampered), true);
  });
});

describe('verifyChecksum()', () => {
  test('returns true for untampered strings', () => {
    assert.equal(verifyChecksum(encode('integrity test')), true);
  });

  test('returns false when the checksum segment is altered', () => {
    const encoded = encode('integrity test');
    const [prefix, payload, checksum] = encoded.split('-');
    const swapped = checksum[0] === '0' ? '1' : '0';
    const tampered = `${prefix}-${payload}-${swapped}${checksum[1]}`;
    assert.equal(verifyChecksum(tampered), false);
  });

  test('returns false when the payload is altered', () => {
    const encoded = encode('integrity test payload');
    const [prefix, payload, checksum] = encoded.split('-');
    const flippedChar = ALPHABET_SAFE_SWAP(payload[0]);
    const tampered = `${prefix}-${flippedChar}${payload.slice(1)}-${checksum}`;
    assert.equal(verifyChecksum(tampered), false);
  });

  test('returns false for malformed strings', () => {
    assert.equal(verifyChecksum('not-a-basecd-string'), false);
  });

  function ALPHABET_SAFE_SWAP(ch) {
    return ch === '0' ? '1' : '0';
  }
});

describe('decode() error handling', () => {
  test('throws BaseCDError on malformed structure', () => {
    assert.throws(() => decode('not-basecd'), BaseCDError);
  });

  test('throws BaseCDError on wrong version prefix', () => {
    assert.throws(() => decode('CD9-ABCDE-FG'), BaseCDError);
  });

  test('throws BaseCDError on checksum mismatch', () => {
    const encoded = encode('tamper detection');
    const [prefix, payload] = encoded.split('-');
    const bad = `${prefix}-${payload}-ZZ`;
    assert.throws(() => decode(bad), BaseCDError);
  });

  test('throws BaseCDError on non-string input', () => {
    assert.throws(() => decode(42), BaseCDError);
  });

  test('error carries a stable machine-readable code', () => {
    try {
      decode('garbage');
      assert.fail('expected decode to throw');
    } catch (err) {
      assert.ok(err instanceof BaseCDError);
      assert.equal(err.code, 'MALFORMED_STRING');
    }
  });

  test('checksum mismatch error carries CHECKSUM_MISMATCH code', () => {
    const encoded = encode('code check');
    const [prefix, payload] = encoded.split('-');
    const tampered = `${prefix}-${payload}-ZZ`;
    try {
      decode(tampered);
      assert.fail('expected decode to throw');
    } catch (err) {
      assert.equal(err.code, 'CHECKSUM_MISMATCH');
    }
  });
});

describe('invalid input types', () => {
  test('rejects null and undefined', () => {
    assert.throws(() => encode(null), BaseCDError);
    assert.throws(() => encode(undefined), BaseCDError);
  });

  test('rejects plain objects', () => {
    assert.throws(() => encode({}), BaseCDError);
    assert.throws(() => encode({ length: 3 }), BaseCDError);
  });

  test('rejects numbers and booleans passed directly', () => {
    assert.throws(() => encode(123), BaseCDError);
    assert.throws(() => encode(true), BaseCDError);
  });

  test('rejects number[] with out-of-range byte values', () => {
    assert.throws(() => encode([1, 2, 300]), BaseCDError);
    assert.throws(() => encode([-1, 0, 1]), BaseCDError);
  });

  test('rejects number[] with non-integer values', () => {
    assert.throws(() => encode([1.5, 2, 3]), BaseCDError);
    assert.throws(() => encode([NaN]), BaseCDError);
    assert.throws(() => encode([Infinity]), BaseCDError);
  });

  test('accepts a valid number[] at the byte-range boundaries', () => {
    const decoded = decode(encode([0, 255]));
    assert.deepEqual(Array.from(decoded), [0, 255]);
  });
});

describe('invalid checksum / corrupted data', () => {
  test('detects a single altered payload character', () => {
    const encoded = encode('a fairly long piece of sample text for corruption testing');
    const [prefix, payload, checksum] = encoded.split('-');
    const midIndex = Math.floor(payload.length / 2);
    const original = payload[midIndex];
    const replacement = original === '0' ? '1' : '0';
    const corrupted = `${prefix}-${payload.slice(0, midIndex)}${replacement}${payload.slice(midIndex + 1)}-${checksum}`;
    assert.equal(verifyChecksum(corrupted), false);
    assert.throws(() => decode(corrupted), BaseCDError);
  });

  test('detects a fully randomized checksum segment', () => {
    const encoded = encode('checksum randomization test');
    const [prefix, payload] = encoded.split('-');
    for (const bogus of ['00', 'ZZ', 'A1', '7Q']) {
      const candidate = `${prefix}-${payload}-${bogus}`;
      // Skip the rare case where the random guess happens to match.
      if (verifyChecksum(candidate)) continue;
      assert.throws(() => decode(candidate), BaseCDError);
    }
  });

  test('detects corrupted data across many random payloads', () => {
    for (let trial = 0; trial < 25; trial++) {
      const length = Math.floor(Math.random() * 40) + 1;
      const bytes = Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
      const encoded = encode(bytes);
      const [prefix, payload, checksum] = encoded.split('-');

      if (payload.length === 0) continue; // nothing to corrupt

      const idx = Math.floor(Math.random() * payload.length);
      const original = payload[idx];
      let replacement = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (replacement === original) {
        replacement = ALPHABET[(ALPHABET.indexOf(original) + 1) % ALPHABET.length];
      }
      const corrupted = `${prefix}-${payload.slice(0, idx)}${replacement}${payload.slice(idx + 1)}-${checksum}`;

      // A single-symbol change essentially always changes the decoded
      // bytes and therefore the checksum; verify decode rejects it.
      assert.equal(verifyChecksum(corrupted), false, `trial ${trial} failed to detect corruption`);
    }
  });

  test('rejects a string with non-zero leftover padding bits', () => {
    // Construct a single-symbol payload whose low bits are non-zero,
    // which is impossible from a real encode() call and indicates
    // hand-edited or corrupted data.
    assert.throws(() => decode('CD1-1-00'), BaseCDError);
  });
});

describe('random data round-trips', () => {
  test('round-trips 50 random byte sequences of varying length', () => {
    for (let trial = 0; trial < 50; trial++) {
      const length = Math.floor(Math.random() * 200);
      const bytes = Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
      const encoded = encode(bytes);
      const decoded = decode(encoded);
      assert.deepEqual(decoded, bytes);
      assert.equal(verifyChecksum(encoded), true);
    }
  });

  test('round-trips random Unicode strings', () => {
    // Split into codepoints (not raw UTF-16 code units) via Array.from,
    // so multi-unit characters like emoji are never split mid-surrogate-pair.
    const pools = ['abcXYZ 123', '日本語テキスト', 'नमस्ते हिन्दी', '🚀🔥✅🎉😀🌍'].map((s) =>
      Array.from(s)
    );
    for (let trial = 0; trial < 20; trial++) {
      const pool = pools[trial % pools.length];
      const len = Math.floor(Math.random() * 30);
      let input = '';
      for (let i = 0; i < len; i++) {
        input += pool[Math.floor(Math.random() * pool.length)];
      }
      assert.equal(decodeToString(encode(input)), input);
    }
  });
});

describe('known test vectors', () => {
  // These vectors are pinned to guard against accidental algorithm
  // changes. If the algorithm changes intentionally, regenerate
  // them via `node scripts/generate-vectors.js` and bump SemVer.
  const vectors = [
    { input: '', expected: 'CD1--00' },
    { input: 'f', expected: 'CD1-CR-6M' },
    { input: 'foobar', expected: 'CD1-CSQPYRK1E8-18' },
  ];

  for (const { input, expected } of vectors) {
    test(`encode(${JSON.stringify(input)}) === ${expected}`, () => {
      assert.equal(encode(input), expected);
    });

    test(`decode(${expected}) round-trips to ${JSON.stringify(input)}`, () => {
      assert.equal(decodeToString(expected), input);
    });
  }
});
