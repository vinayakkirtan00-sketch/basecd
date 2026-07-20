# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Package renamed from `basecd` to the scoped `@convertdock/basecd` on
  npm. `require`/`import` paths, install instructions, and the `types`
  field are unaffected in behavior — only the package name changes.
  `publishConfig.access` is set to `public` since scoped packages
  default to private on npm.

## [1.0.1] - 2026-07-20

### Fixed

- `encode()` on a `number[]` input no longer silently wraps out-of-range
  or non-integer values (e.g. `encode([300])` or `encode([1.5])`); it now
  throws `BaseCDError` with code `INVALID_INPUT_TYPE`, matching the
  documented byte-range contract.

### Changed

- `packSymbols()` now builds output via a pre-sized array + `join()`
  instead of repeated string concatenation, and `unpackSymbols()` writes
  directly into a pre-sized `Uint8Array` instead of a plain array plus a
  conversion pass. No public API or output format changes; encode/decode
  results are byte-for-byte identical to 1.0.0, just faster on large
  inputs.
- `TextEncoder`/`TextDecoder` instances are now created once at module
  scope instead of per call.

### Added

- README: comparison table (BaseCD vs. Base64 vs. Base32 vs. Base58),
  Performance Benchmark section, Real-world Use Cases section, and
  Roadmap section.
- Expanded unit test suite: dedicated Unicode coverage (Hindi, Japanese,
  emoji incl. ZWJ sequences, embedded control characters), invalid-input
  type tests, invalid-checksum/corrupted-data tests, and randomized
  round-trip tests.

## [1.0.0] - 2026-07-20

### Added

- Initial public release of BaseCD.
- BaseCD Specification v1.0 (`docs/SPECIFICATION.md`), covering the
  32-symbol alphabet, encoding/decoding algorithms, `CD1-` prefix
  format, CRC-8 checksum format, validation rules, error codes, and
  pinned test vectors.
- JavaScript reference implementation (`src/basecd.js`) with:
  - `encode()` — encode strings, `Uint8Array`, `Buffer`, or byte arrays
  - `decode()` — decode to raw bytes with full integrity checking
  - `decodeToString()` — convenience UTF-8 decode wrapper
  - `validate()` — structural-only validation
  - `verifyChecksum()` — full integrity validation
  - `BaseCDError` — typed error class with stable `.code` values
- TypeScript type definitions (`src/basecd.d.ts`).
- Unit test suite (`test/basecd.test.js`) covering round-trips across
  text, Unicode, and binary inputs, format invariants, error handling,
  and pinned specification test vectors.
- Runnable examples: basic usage, file encoding, error handling, and a
  throughput benchmark (`examples/`).
- Project governance and community files: `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- GitHub Actions CI workflow running the test suite on Node.js 16, 18,
  20, and 22.

[1.0.1]: https://github.com/vinayakkirtan00-sketch/basecd/releases/tag/v1.0.1
[1.0.0]: https://github.com/vinayakkirtan00-sketch/basecd/releases/tag/v1.0.0
