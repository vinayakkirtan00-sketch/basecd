# BaseCD Specification

**Version:** 1.0
**Status:** Stable
**Prefix:** `CD1-`
**Maintainer:** ConvertDock

---

## 1. Introduction

BaseCD is a binary-to-text encoding scheme designed for representing arbitrary
byte sequences as short, human-transcribable strings. It is developed and
maintained by [ConvertDock](https://convertdock.online) as part of its suite
of encoding and conversion utilities.

BaseCD combines three ideas that are individually well established —
alphabet-restricted Base32-style encoding, versioned format prefixes, and
embedded checksums — into a single self-describing format. A BaseCD string
carries everything needed to detect (though not correct) transcription
errors and data corruption, without any external metadata or schema.

A BaseCD string has the form:

```
CD1-<payload>-<checksum>
```

For example, the UTF-8 string `"foobar"` encodes to:

```
CD1-CSQPYRK1E8-18
```

## 2. Goals

BaseCD is designed to satisfy the following goals, in priority order:

1. **Losslessness.** Any byte sequence must encode and decode back to
   itself exactly, with no ambiguity.
2. **Transcription safety.** The symbol alphabet must avoid characters
   that are commonly confused by humans (e.g. `0`/`O`, `1`/`I`/`L`) or by
   OCR systems.
3. **Self-description.** A BaseCD string should be identifiable as such at
   a glance, and should carry a version marker so future revisions of the
   format can coexist safely.
4. **Corruption detection.** A single-character error, deletion, or
   transposition in a BaseCD string should be detectable via checksum
   verification in the overwhelming majority of cases.
5. **Simplicity.** The algorithm should be implementable in a few dozen
   lines in any mainstream language, with no external dependencies.
6. **URL and filename safety.** Valid BaseCD strings must never require
   percent-encoding in URLs and must be safe to use as filenames on all
   major operating systems.

BaseCD explicitly does **not** aim to be the most space-efficient encoding
available (Base64 is denser), nor does it aim to provide cryptographic
integrity guarantees (its checksum detects accidental corruption, not
deliberate tampering by an adversary who can recompute checksums).

## 3. Design Principles

- **Fixed alphabet size of 32.** Each symbol encodes exactly 5 bits,
  which keeps the bit-packing arithmetic simple and avoids the uneven
  padding rules that complicate Base64.
- **No case sensitivity.** Decoding accepts both upper and lower case;
  encoding always emits uppercase. This means BaseCD strings survive
  being typed, read aloud, or passed through case-insensitive systems.
- **No line breaks, no external padding characters.** Unlike Base64's
  `=` padding, BaseCD never emits padding symbols; partial trailing
  groups are zero-padded internally and validated on decode.
- **Explicit versioning.** The `CD1` prefix is not decorative — it is a
  format version marker. A future `CD2` encoding could change the
  alphabet, checksum algorithm, or bit width without any risk of being
  silently misinterpreted as `CD1` data.
- **Checksum is embedded, not optional.** Every encoder output includes
  a checksum; there is no "checksum-less" mode. This keeps the format's
  error-detection guarantee unconditional.

## 4. Character Set

BaseCD uses a 32-symbol alphabet derived from the 36 alphanumeric
characters (`0-9`, `A-Z`), with four letters excluded for readability:

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

**Excluded characters:** `I`, `L`, `O`, `U`

| Excluded | Reason |
|---|---|
| `I` | Visually confusable with `1` and `L` |
| `L` | Visually confusable with `1` and `I` |
| `O` | Visually confusable with `0` |
| `U` | Frequently misread as `V` in handwriting and some fonts |

This gives exactly 32 symbols (2⁵), so each symbol maps cleanly to 5 bits
with no wasted or ambiguous states.

Structural characters `C`, `D`, and `-` also appear in the literal prefix
and as field separators; they are reserved and never appear as the *first*
character of a version marker for any value other than the literal `CD`
sequence. This does not restrict the payload alphabet, since `C` and `D`
are valid payload symbols — only their specific positions in the prefix
are reserved.

## 5. Encoding Rules

Given an input byte sequence `B` of length `n`:

1. Treat `B` as a single big-endian bitstream of `8n` bits.
2. Divide the bitstream into consecutive 5-bit groups, reading
   most-significant-bit first.
3. Map each 5-bit group (value 0–31) to its corresponding symbol in the
   alphabet, in order, to produce the **payload**.
4. If the final group has fewer than 5 bits remaining, left-align the
   remaining bits within the group and pad the low-order bits with
   zeros before mapping to a symbol. (This is identical in spirit to
   Base32/Base64 padding, but BaseCD never emits a padding *character*
   — the padding is purely bit-level and implicit in the final symbol.)
5. Compute `checksum = CRC-8(B)` per §8, and encode the resulting byte
   using the same 5-bit packing rule from steps 1–4, always producing
   exactly 2 symbols.
6. Assemble the final string as:

   ```
   CD1-<payload>-<checksum>
   ```

   If `B` is empty, `<payload>` is the empty string and the result is
   `CD1--<checksum>` (note the adjacent dashes).

### Bits-to-symbols reference

| Input bytes | Total bits | Payload symbols |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 8 | 2 |
| 2 | 16 | 4 |
| 3 | 24 | 5 |
| 4 | 32 | 7 |
| 5 | 40 | 8 |

In general, payload length in symbols is `ceil(8n / 5)`.

## 6. Decoding Rules

Given a candidate string `S`:

1. Trim leading/trailing whitespace and convert to uppercase.
2. Match `S` against the structural pattern
   `CD1-<payload>-<checksum>`, where `<payload>` is zero or more
   alphabet symbols and `<checksum>` is exactly two alphabet symbols.
   If the pattern does not match, reject with `MALFORMED_STRING`.
3. Unpack `<payload>` from 5-bit symbol groups back into a byte
   sequence, most-significant-bit first, reversing §5 steps 1–2.
4. If, after consuming all payload symbols, leftover bits remain
   (fewer than 5, insufficient to form another byte), verify they are
   **all zero**. Non-zero leftover bits indicate the string was
   corrupted or hand-edited; reject with `INVALID_PADDING`.
5. Recompute the CRC-8 checksum of the decoded bytes and re-encode it
   as 2 symbols per §5 step 5. Compare against `<checksum>` from the
   input. If they differ, reject with `CHECKSUM_MISMATCH`.
6. If all checks pass, return the decoded byte sequence.

## 7. Prefix Format (`CD1-`)

The prefix identifies both the format family and its version:

- `CD` — literal marker identifying the string as BaseCD-encoded.
- `1` — format version. Governs the alphabet, bit width, and checksum
  algorithm in effect for this string.
- `-` — separator, always present, always singular.

A decoder that encounters a prefix other than `CD1` (e.g. `CD2`, once a
future version exists) MUST refuse to decode it as BaseCD v1 data rather
than attempting a best-effort decode. This is a deliberate compatibility
boundary: version bumps are permitted to be breaking.

## 8. Checksum Format

BaseCD uses **CRC-8** with the polynomial `0x07` (the same polynomial
used by CRC-8-CCITT/ATM), computed over the *original input bytes*
(before encoding), MSB-first, with an initial value of `0x00` and no
final XOR.

The resulting single byte is encoded using the standard BaseCD 5-bit
packing rule (§5), which always yields exactly **2 symbols** for a
single byte (10 bits of capacity for 8 bits of data, left-padded).

Reference pseudocode:

```
function crc8(bytes):
    crc = 0x00
    for byte in bytes:
        crc = crc XOR byte
        repeat 8 times:
            if crc & 0x80:
                crc = (crc << 1) XOR 0x07, masked to 8 bits
            else:
                crc = (crc << 1), masked to 8 bits
    return crc
```

CRC-8 is chosen over a cryptographic hash because BaseCD's checksum goal
is accidental-error detection (typos, transmission glitches, truncation),
not adversarial tamper-proofing. See §12 (Security Notes) for the
implications of this choice.

## 9. Validation Rules

A string is **structurally valid** BaseCD if and only if:

1. It matches `CD1-<payload>-<checksum>` where `<payload>` consists of
   zero or more characters from the 32-symbol alphabet, and
   `<checksum>` consists of exactly two characters from the alphabet.
2. The payload's trailing partial bit-group (if any) consists entirely
   of zero padding bits once unpacked.

A string is **fully valid** (integrity-verified) BaseCD if and only if it
is structurally valid **and** its checksum matches the CRC-8 of its
decoded payload bytes, per §8.

Reference implementations expose both levels of validation separately:
a structural check (`validate()`) for cheap syntactic filtering, and a
full integrity check (`verifyChecksum()` / `decode()`) for cases where
data correctness matters.

## 10. Error Handling

Implementations MUST distinguish between the following error conditions
using stable, documented error codes:

| Code | Condition |
|---|---|
| `INVALID_INPUT_TYPE` | Input to encode/decode is not a supported type (e.g. decoding a non-string) |
| `MALFORMED_STRING` | Input does not match the `CD1-<payload>-<checksum>` structural pattern |
| `INVALID_SYMBOL` | A character outside the 32-symbol alphabet appears where a symbol is expected |
| `INVALID_PADDING` | Leftover bits after unpacking the payload are non-zero |
| `CHECKSUM_MISMATCH` | Structural decode succeeded but the checksum does not match |

Implementations SHOULD throw/raise a single well-typed error class (e.g.
`BaseCDError`) carrying one of the above codes, rather than generic
exceptions, so that calling code can branch on failure type
programmatically.

Decoding MUST fail closed: any condition not explicitly covered by a
passing rule in §6 is a rejection, never a best-effort partial decode.

## 11. Test Vectors

All vectors below are generated directly from the reference
implementation in `src/basecd.js` and are asserted in
`test/basecd.test.js`. Implementations in other languages should
reproduce these exactly.

| Input (UTF-8 string) | BaseCD Output |
|---|---|
| `""` (empty) | `CD1--00` |
| `"a"` | `CD1-C4-40` |
| `"f"` | `CD1-CR-6M` |
| `"fo"` | `CD1-CSQG-G4` |
| `"foo"` | `CD1-CSQPY-GG` |
| `"foob"` | `CD1-CSQPYRG-QG` |
| `"fooba"` | `CD1-CSQPYRK1-3M` |
| `"foobar"` | `CD1-CSQPYRK1E8-18` |
| `"BaseCD"` | `CD1-89GQ6SA38G-B0` |
| `"Hello, World!"` | `CD1-91JPRV3F5GG5EVVJDHJ22-GW` |

Binary (non-text) vectors, given as byte arrays:

| Input bytes | BaseCD Output |
|---|---|
| `[]` | `CD1--00` |
| `[0, 255, 128, 64]` | `CD1-03ZR0G0-B8` |
| `[255, 255, 255, 255, 255]` | `CD1-ZZZZZZZZ-WW` |

## 12. Performance Notes

- Encoding and decoding are both **O(n)** in the length of the input,
  with a small constant factor (one 5-bit or 8-bit shift/mask operation
  per symbol/byte).
- The reference JavaScript implementation processes data in a single
  pass with no intermediate array allocations beyond the output buffer,
  making it suitable for reasonably large payloads (tested to 1 MB+ in
  this repository's benchmarks).
- BaseCD's space overhead is fixed and predictable: encoded length is
  `8 + ceil(8n/5)` characters for an `n`-byte input (7 characters of
  fixed prefix/separators/checksum, plus `ceil(8n/5)` payload
  characters). This is denser than hex encoding (which needs `2n`
  characters) but less dense than Base64 (`~1.33n` characters), a
  deliberate tradeoff for the excluded-character safety margin in §4.
- Because BaseCD has no cross-symbol dependencies beyond simple bit
  packing, encoding and decoding are trivially parallelizable across
  chunks for very large inputs, though the reference implementation
  does not currently do this.

## 13. Security Notes

- **The checksum is not a security control.** CRC-8 is trivially
  forgeable — anyone able to modify a BaseCD string can also recompute
  a matching checksum. BaseCD's checksum exists to catch *accidental*
  corruption (typos, truncated copy-paste, transmission bit-flips), not
  to authenticate data against a malicious actor. Do not use BaseCD
  checksums as a substitute for HMACs, digital signatures, or other
  cryptographic integrity mechanisms in security-sensitive contexts.
- **BaseCD is not encryption.** It is a reversible, deterministic
  encoding with no key material. Anyone can decode any BaseCD string.
  Do not use BaseCD to "hide" sensitive data — it provides zero
  confidentiality.
- **Decoders must fail closed.** Per §10, malformed input must always
  be rejected rather than partially processed, to avoid downstream
  systems silently accepting corrupted data as valid.
- **Untrusted input sizing.** Because encode/decode is O(n), consumers
  that decode BaseCD strings from untrusted sources (e.g. URL
  parameters) should apply their own upper bound on input string length
  before decoding, to avoid unbounded resource consumption on
  adversarially large inputs.

## 14. Examples

### Encoding plain text

```js
const { encode } = require('@convertdock/basecd');

encode('Hello, World!');
// => "CD1-91JPRV3F5GG5EVVJDHJ22-GW"
```

### Decoding back to a UTF-8 string

```js
const { decodeToString } = require('@convertdock/basecd');

decodeToString('CD1-CSQPYRK1E8-18');
// => "foobar"
```

### Validating structure without checking integrity

```js
const { validate } = require('@convertdock/basecd');

validate('CD1-CSQPYRK1E8-18'); // => true
validate('not-a-basecd-string'); // => false
```

### Verifying integrity (catching corruption)

```js
const { verifyChecksum } = require('@convertdock/basecd');

verifyChecksum('CD1-CSQPYRK1E8-18'); // => true
verifyChecksum('CD1-CSQPYRK1E9-18'); // => false (payload was altered)
```

### Encoding arbitrary binary data

```js
const { encode, decode } = require('@convertdock/basecd');

const bytes = new Uint8Array([0, 255, 128, 64]);
const encoded = encode(bytes); // => "CD1-03ZR0G0-B8"
const decoded = decode(encoded); // => Uint8Array [0, 255, 128, 64]
```

---

*This specification is versioned independently of the reference
implementation's package version. Breaking changes to the wire format
require a new prefix version (`CD2`, `CD3`, ...); the implementation's
SemVer version tracks code changes, which may include non-breaking
fixes, performance work, or additional language bindings.*
