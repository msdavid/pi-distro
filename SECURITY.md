# Security Policy

pi-distro is a [pi](https://pi.dev/) package. Like all pi packages, its
extensions run with your full system permissions and can execute arbitrary code,
and its skills can instruct the model to run executables. Security therefore
matters for *users* and *contributors* alike.

## Supported versions

Only the latest published version of `@msdavid/pi-distro` receives security
updates.

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.** Instead:

1. Open a **private security advisory** on GitHub:
   [Report a vulnerability](https://github.com/msdavid/pi-distro/security/advisories/new).
2. If you cannot use GitHub security advisories, open an issue titled
   "Security contact request" so a maintainer can reach you privately. Do not
   include vulnerability details in the issue.

Please include:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected versions, if known.
- Any suggested fix.

A maintainer will acknowledge your report within a reasonable timeframe, discuss
the fix and disclosure timeline with you, and credit you in the advisory unless
you prefer to remain anonymous.

## Scope

In scope: vulnerabilities in this repository's code that could lead to
unexpected code execution, data loss, or that weaken the trust/confirmation
flows around deploying third-party distros (e.g. the GitHub-distro trust gate).

Out of scope: vulnerabilities in pi itself (report those to the
[pi project](https://github.com/earendil-works/pi)), or in third-party distros
installed via pi-distro — those belong to their respective maintainers.

## Hardening notes for users

- pi-distro always asks for explicit confirmation before cloning and deploying a
  distro from GitHub. Never deploy a distro from a source you do not trust.
- Review the contents of any seed or GitHub distro (`/pi-distro show <ref>`)
  before deploying it.
