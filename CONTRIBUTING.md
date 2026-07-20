# Contributing to BaseCD

Thanks for your interest in contributing to BaseCD. This document covers
how to report issues, propose changes, and get a pull request merged.

## Before You Start

BaseCD is both a **specification** and a **reference implementation**.
Most contributions fall into one of these categories:

- **Implementation bug fixes** — the code doesn't match the spec.
- **New language bindings** — a BaseCD implementation in a language
  other than JavaScript.
- **Tooling and docs** — examples, tests, CI, developer experience.
- **Specification changes** — proposals that change the wire format
  itself.

Specification changes are held to a much higher bar than implementation
changes, since they affect interoperability. See [Changing the
Specification](#changing-the-specification) below before opening that
kind of PR.

## Reporting Issues

When filing a bug report, please include:

- The input you encoded/decoded (or a minimal reproduction).
- The output you got vs. the output you expected.
- Your Node.js version (`node --version`) and OS.
- Whether the issue is in the reference implementation or in the
  specification itself.

For security-related issues, do **not** open a public issue — see
[SECURITY.md](SECURITY.md).

## Development Setup

```bash
git clone https://github.com/vinayakkirtan00-sketch/basecd.git
cd basecd
npm install
npm test
```

The project has no runtime dependencies; `npm install` only sets up
development tooling.

## Making Changes

1. Fork the repository and create a branch from `main`.
2. Make your changes. Keep commits focused and descriptive.
3. Add or update tests in `test/basecd.test.js` for any behavioral
   change. PRs that change behavior without test coverage will be
   asked to add it.
4. Run the full test suite locally:

   ```bash
   npm test
   ```

5. If your change affects documented behavior, update
   `docs/SPECIFICATION.md` and `README.md` in the same PR — code and
   docs should never drift apart.
6. Open a pull request against `main` with a clear description of the
   change and why it's needed.

## Coding Standards

- No runtime dependencies in `src/basecd.js`. This is a deliberate
  design constraint, not an oversight.
- Prefer clarity over cleverness — this file is meant to be readable
  as a reference implementation, including by people porting it to
  other languages.
- Every public function must have a JSDoc comment describing its
  parameters, return value, and error behavior.
- New error conditions must use `BaseCDError` with a documented,
  stable `.code`, not a generic `Error`.

## Changing the Specification

The specification (`docs/SPECIFICATION.md`) defines the BaseCD wire
format. Because other implementations (present or future, in other
languages) depend on it, changes fall into two categories:

- **Clarifications** — fixing ambiguous wording, adding examples,
  correcting typos. These are welcome as regular PRs.
- **Behavioral changes** — anything that would cause an existing valid
  BaseCD string to decode differently, or an existing implementation
  to reject strings it previously accepted (or vice versa). These
  **must** target a new format version (e.g. `CD2`) rather than
  silently changing `CD1` behavior. Open an issue to discuss the
  proposal before writing a PR.

## Pull Request Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] New behavior has test coverage
- [ ] `docs/SPECIFICATION.md` updated if wire-format-relevant
- [ ] `README.md` updated if public API changed
- [ ] `CHANGELOG.md` entry added under an `[Unreleased]` heading

## Code of Conduct

This project follows the [Contributor Covenant Code of
Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## License

By contributing, you agree that your contributions will be licensed
under the project's [MIT License](LICENSE).
