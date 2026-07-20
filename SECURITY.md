# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BaseCD, please report it
privately rather than opening a public GitHub issue.

- **Preferred:** Use GitHub's [private vulnerability reporting](https://github.com/vinayakkirtan00-sketch/basecd/security/advisories/new)
  feature on this repository.
- **Alternative:** Email **security@convertdock.online** with a
  description of the issue, steps to reproduce, and its potential
  impact.

Please include as much of the following as you can:

- A clear description of the vulnerability and its impact.
- Steps to reproduce, or a minimal proof-of-concept.
- The affected version(s) of BaseCD.
- Any suggested remediation, if you have one.

We aim to acknowledge reports within **3 business days** and to provide
a more detailed response, including next steps, within **10 business
days**.

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | ✅ |
| < 1.0 | ❌ (pre-release, not supported) |

## Scope and Important Context

BaseCD is an **encoding**, not an encryption or authentication scheme.
Please read [§13 Security Notes in the specification](docs/SPECIFICATION.md#13-security-notes)
before reporting an issue, since some behaviors that look like
vulnerabilities are actually documented, intentional properties of the
format:

- **BaseCD provides no confidentiality.** Anyone can decode any BaseCD
  string; there is no key material. This is by design, not a bug.
- **The embedded checksum (CRC-8) is not a security control.** It
  detects accidental corruption, not adversarial tampering — an
  attacker who can modify a BaseCD string can also recompute a valid
  checksum for their modified data. Do not report "checksum can be
  forged" as a vulnerability; this is documented and expected.

Legitimate security concerns we *do* want reported include things like:

- Implementation bugs that cause `decode()` to silently accept invalid
  or corrupted data (a fail-closed violation).
- Resource-exhaustion issues (e.g. unbounded memory/CPU use) when
  processing untrusted input.
- Any deviation between the reference implementation and the published
  specification that could cause interoperability or correctness
  issues across implementations.

## Disclosure Policy

We follow a coordinated disclosure process: once a fix is available, we
will credit reporters (unless they prefer to remain anonymous) in the
release notes and `CHANGELOG.md`.
