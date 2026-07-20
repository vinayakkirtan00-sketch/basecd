# BaseCD

[![CI](https://github.com/vinayakkirtan00-sketch/basecd/actions/workflows/ci.yml/badge.svg)](https://github.com/vinayakkirtan00-sketch/basecd/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Spec: v1.0](https://img.shields.io/badge/spec-v1.0-blue.svg)](docs/SPECIFICATION.md)
[![npm](https://img.shields.io/badge/npm-%40convertdock%2Fbasecd-red.svg)](https://www.npmjs.com/package/@convertdock/basecd)

**BaseCD** is a human-friendly, self-verifying binary-to-text encoding
developed by [ConvertDock](https://convertdock.online). It encodes any
byte sequence — text, files, binary blobs — into a compact, transcription-safe
string with a built-in checksum, so corrupted or mistyped data is caught
automatically on decode.

```
"Hello, World!"  →  CD1-91JPRV3F5GG5EVVJDHJ22-GW
```

## Why BaseCD?

Base64 and Base32 were designed to move bytes through text-only channels
efficiently — not to be typed, read aloud, printed on a package, or
pasted into a URL by a human. BaseCD is designed for the opposite case:
strings that people and systems both need to handle correctly, where a
single mistyped character should be *caught*, not silently accepted as
different data.

- **Typo-resistant alphabet.** No `I`, `L`, `O`, or `U` — the characters
  people and OCR systems confuse most often are simply not in the alphabet.
- **Self-verifying.** Every encoded string carries an embedded CRC-8
  checksum. A single mistyped or corrupted character is caught on decode,
  automatically, with no external validation logic required.
- **Self-describing.** The `CD1-` prefix identifies the format and its
  version at a glance — no guessing whether a string is Base64, hex, or
  something else.
- **Zero dependencies.** The reference implementation is a single file
  with no runtime dependencies, usable in Node.js or the browser.
- **Fully specified.** Every design decision, from alphabet choice to
  error codes, is documented in the [BaseCD Specification](docs/SPECIFICATION.md),
  so the format can be reimplemented consistently in any language.

### BaseCD vs. Base64 vs. Base32 vs. Base58

| Feature                        | BaseCD          | Base64 | Base32 | Base58 |
|---------------------------------|:----------------:|:------:|:------:|:------:|
| URL safe                       | ✅               | ⚠️ (URL-safe variant only) | ✅ | ✅ |
| Human friendly (no ambiguous chars) | ✅          | ❌     | ⚠️ (keeps `0`/`O`, `1`/`I`) | ✅ |
| Built-in checksum              | ✅ (CRC-8)       | ❌     | ❌     | ❌     |
| Version prefix                 | ✅ (`CD1-`)      | ❌     | ❌     | ❌     |
| No padding characters          | ✅               | ❌ (`=` padding) | ⚠️ (RFC variant pads) | ✅ |
| Unicode / arbitrary bytes support | ✅ (any byte sequence) | ✅ | ✅ | ✅ |
| Format self-validation         | ✅ (`validate()`) | ❌    | ❌     | ❌     |
| Error detection on decode      | ✅ (checksum mismatch throws) | ❌ (decodes garbage silently) | ❌ | ❌ |

Base64, Base32, and Base58 are still the right choice when you just need
compact, standardized byte-to-text transport and don't need built-in
integrity checking — BaseCD trades a little size efficiency for
transcription safety and self-description, which matters most for
strings a *human* will type, read, or copy.

## Installation

```bash
npm install @convertdock/basecd
```

Or copy `src/basecd.js` directly into your project — it has no dependencies.

## Quick Start

```js
const { encode, decode, decodeToString, validate, verifyChecksum } = require('@convertdock/basecd');

// Encode text
const encoded = encode('Hello, World!');
console.log(encoded); // "CD1-91JPRV3F5GG5EVVJDHJ22-GW"

// Decode back to text
console.log(decodeToString(encoded)); // "Hello, World!"

// Encode arbitrary binary data
const bytes = new Uint8Array([0, 255, 128, 64]);
const encodedBytes = encode(bytes); // "CD1-03ZR0G0-B8"
console.log(decode(encodedBytes)); // Uint8Array [0, 255, 128, 64]

// Check structure only (fast, no integrity check)
validate('CD1-CSQPYRK1E8-18'); // true

// Check structure AND integrity (catches corruption)
verifyChecksum('CD1-CSQPYRK1E8-18'); // true
verifyChecksum('CD1-CSQPYRK1E9-18'); // false — payload was altered
```

## API

### `encode(input)`

Encodes `input` (a `string`, `Uint8Array`, `Buffer`, or `number[]`) into a
BaseCD string. Strings are UTF-8 encoded before packing.

### `decode(basecdString)`

Decodes a BaseCD string back into a `Uint8Array` of the original bytes.
Throws a `BaseCDError` (with a stable `.code`) if the string is malformed
or its checksum does not match — see [Error Handling](docs/SPECIFICATION.md#10-error-handling).

### `decodeToString(basecdString)`

Convenience wrapper around `decode()` that UTF-8 decodes the result back
into a JavaScript string.

### `validate(basecdString)`

Returns `true` if the string is *structurally* well-formed BaseCD (correct
prefix, valid alphabet, correct segment shapes). Does **not** check the
checksum — use this for cheap syntactic filtering (e.g. form input),
and `verifyChecksum()` when correctness of the underlying data matters.

### `verifyChecksum(basecdString)`

Returns `true` only if the string is structurally valid **and** its
embedded checksum matches its payload. This is the check to use when you
need to know the data hasn't been corrupted or mistyped.

Full behavioral details, including every error code and edge case, are
defined in the [**BaseCD Specification v1.0**](docs/SPECIFICATION.md).

## Format at a Glance

```
CD1  -  CSQPYRK1E8  -  18
 │         │           │
 │         │           └─ 2-symbol CRC-8 checksum
 │         └───────────── variable-length payload (5 bits/symbol)
 └─────────────────────── version prefix (BaseCD, v1)
```

Alphabet (32 symbols): `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
(digits + A–Z, excluding `I`, `L`, `O`, `U`)

## Performance Benchmark

`encode()`/`decode()` are linear in input size, O(n). Representative
numbers from [`examples/benchmark.js`](examples/benchmark.js) on a single
machine (Node.js, your results will vary):

| Payload size | Encode throughput | Decode throughput |
|---|---|---|
| 64 B   | ~17 MB/s | ~24 MB/s |
| 1 KB   | ~19 MB/s | ~25 MB/s |
| 64 KB  | ~10 MB/s | ~14 MB/s |
| 1 MB   | ~8 MB/s  | ~13 MB/s |

Run it yourself with:

```bash
npm run benchmark
```

BaseCD is well suited to the short, human-facing strings it's designed
for (tokens, codes, IDs); for bulk binary transport of large files,
a lower-overhead encoding without per-symbol checksumming (or a binary
protocol) will always be faster.

## Real-world Use Cases

BaseCD fits anywhere a string needs to survive being typed, printed,
scanned, or copied by hand — and you want to know immediately if it didn't:

- **QR codes** — shorter, checksum-protected payloads mean scan errors
  and partial reads are caught before they cause bad data downstream.
- **Invite codes** — typo-resistant alphabet means a mistyped character
  fails validation instead of silently matching a different invite.
- **Coupon codes** — the embedded checksum stops customers (and bots)
  from guessing valid-looking codes at random.
- **Referral codes** — self-describing `CD1-` prefix makes codes easy to
  identify and filter out of logs, support tickets, or free-text search.
- **API tokens** — structural `validate()` gives cheap request-time
  filtering before a full lookup, and `verifyChecksum()` catches
  copy-paste corruption early.
- **URLs** — no `+`, `/`, or `=` padding to percent-encode, unlike
  standard Base64.
- **Short IDs** — compact, unambiguous when read aloud over the phone or
  transcribed from a screenshot.

## Examples

See [`examples/`](examples/) for runnable scripts covering:

- [`basic-usage.js`](examples/basic-usage.js) — encode/decode/validate walkthrough
- [`file-encoding.js`](examples/file-encoding.js) — encoding binary file contents
- [`error-handling.js`](examples/error-handling.js) — handling every `BaseCDError` code
- [`benchmark.js`](examples/benchmark.js) — throughput on various payload sizes

Run any example with:

```bash
node examples/basic-usage.js
```

## Testing

```bash
npm test
```

The test suite covers round-tripping across text, binary, and Unicode
inputs, format invariants, structural and integrity validation, error
codes, and a set of pinned test vectors shared with the specification.

## Project Structure

```
basecd/
├── src/
│   ├── basecd.js       # Reference implementation
│   └── basecd.d.ts     # TypeScript definitions
├── test/
│   └── basecd.test.js  # Unit tests (Node.js built-in test runner)
├── examples/
│   ├── basic-usage.js
│   ├── file-encoding.js
│   ├── error-handling.js
│   └── benchmark.js
├── docs/
│   └── SPECIFICATION.md  # BaseCD Specification v1.0
└── .github/workflows/ci.yml
```

## Specification

BaseCD is a documented, versioned format, not just a code snippet. Read
the full [**BaseCD Specification v1.0**](docs/SPECIFICATION.md) for:

- Design goals and principles
- The complete character set and rationale
- Formal encoding/decoding algorithms
- Checksum computation (CRC-8)
- Validation rules and error codes
- Verified test vectors
- Performance and security notes

Implementers targeting other languages should treat this document, not
this repository's JavaScript source, as the source of truth.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines on filing issues, proposing changes, and submitting pull
requests. Please also review our [Code of Conduct](CODE_OF_CONDUCT.md).

## Roadmap

BaseCD follows semantic versioning; the `CD1-` prefix will only change
on a breaking format change (e.g. a future `CD2`).

**v1.1 (planned, backward compatible)**
- Streaming encode/decode for large inputs (avoid holding the full
  payload in memory at once).
- Official Python reference implementation, generated from the same
  pinned test vectors as the JavaScript implementation.
- Additional language bindings tracked via the [Specification](docs/SPECIFICATION.md).

**v2.0 (future, would require a version bump)**
- Optional longer checksum (e.g. CRC-16) for use cases needing stronger
  error detection than CRC-8, negotiated via a new version prefix so
  `CD1-` strings keep decoding forever.
- Optional compact binary framing for non-text transports.

**Future / under consideration**
- CLI tool for encoding/decoding from the shell and piping stdin/stdout.
- Browser-based encode/decode playground.
- Additional real-world integration guides (QR code libraries, URL
  shorteners, coupon systems).

Nothing here is a commitment or a timeline — see [CONTRIBUTING.md](CONTRIBUTING.md)
if you'd like to help build any of it. `v1.x` will always remain fully
backward compatible; anything that isn't gets a new version prefix.

## Security

BaseCD is an **encoding format, not encryption**. It provides no
confidentiality — anyone can decode any BaseCD string, and the embedded
checksum detects accidental corruption, not adversarial tampering. See
[SECURITY.md](SECURITY.md) for the full scope and how to report a
vulnerability.

## License

BaseCD is released under the [MIT License](LICENSE).

## About ConvertDock

BaseCD is developed by [ConvertDock](https://convertdock.online), a
free, browser-based collection of converters, calculators, and utility
tools.
