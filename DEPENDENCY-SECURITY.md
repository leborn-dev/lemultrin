# Dependency security maintenance (2026-10-18)

This update refreshes compatible Yarn dependencies, updates webpack-cli
3.3.11 -> 3.3.12 (which accepts patched loader-utils 1.4.x), and updates
@types/styled-components 5.1.0 -> 5.1.9 (which no longer pulls unused React Native
types/tooling). Electron major version and native addon ABI are unchanged. The icon color
calculation now validates the PNG boundary before the inherited format sniffer.

A single scoped Yarn resolution selects form-data 2.5.6 only for
`iohook/nugget/request/form-data`. Request 2.88.2 pins `~2.3.2`, so ordinary
compatible refresh cannot reach the security fixes. This resolution deliberately
crosses that minor range within form-data major 2; it does not replace request,
iohook, or their native binding. Yarn's incompatible-range warning is expected.

The official advisories require 2.5.4 for unpredictable multipart boundaries
(GHSA-fjxv-7rqg-78g4) and 2.5.6 for multipart field/filename CRLF escaping
(GHSA-hmw2-7cc7-3qxx). Both fixes are covered by `yarn test:installer`: the test
resolves the real installer dependency chain without loading native iohook,
checks that boundary generation does not call Math.random, checks CRLF header
escaping, and uses the actual request package for a localhost multipart
field/binary-file roundtrip including boundary/content-length verification.
The boundary regression failed against form-data 2.3.3 before this resolution.

Validation: fresh isolated Node 14.21.3 and Node 22.23.3 Linux containers each
passed `yarn install --frozen-lockfile --ignore-scripts --non-interactive`,
`yarn test:installer`, and `yarn build`, producing the main/renderer bundles and
HTML. Node 14 was a legacy compiler compatibility check, not a recommendation
for a new deployment. Native install scripts were intentionally disabled.
Electron GUI, native rebuild, packaging, window embedding, and auto-update were
not validated. Full development type checking is not established by the
production transpile-only Webpack build.

Yarn audit's advisory/path count decreased from 501 (critical41/high239/
moderate175/low46) to 134 (critical0/high60/moderate63/low11). These are
advisory-resolution-path counts, not GitHub alert counts or proof that the app
is secure. Remaining findings include the unsupported Electron 8 and Webpack 4
stack, request/tough-cookie in the native install downloader, and packages with
no patched release such as request, ip, elliptic, and some transitive utilities.
The form-data resolution does not fix request's separate SSRF advisory.
Modernizing Electron/native addons requires platform GUI/ABI validation and is
outside this narrowly tested update. No audit suppression or alert dismissal is
used.

Sources:
- https://github.com/advisories/GHSA-fjxv-7rqg-78g4
- https://github.com/advisories/GHSA-hmw2-7cc7-3qxx

## Image-sniffer advisory boundary

The compatible node-vibrant 3.1.6 update uses Jimp/file-type 16.5.4, which retains
GHSA-5v7r-6r5c-r473 (ASF parsing infinite loop). Pinning node-vibrant 3.1.5 was
compared and rejected because it reintroduced jpeg-js high
GHSA-xvf7-4v9q-58w6 and moderate GHSA-w7q9-p3jq-fmhm. The advisory/path diff is
recorded in the review evidence; the ASF advisory is not suppressed or resolved
in the dependency itself.

`prepareContainer` now calls `getIconPalette` for the same extract-file-icon
Buffer, which is expected to be a 16px PNG. The helper requires the PNG
signature, a complete IHDR with dimensions 1..512, bounded 4MiB input, and
bounded complete chunks ending in IEND with image data. Non-Buffers, ASF, empty,
truncated and structurally invalid containers are skipped before Vibrant's
format sniffer. PNG pixel decoding and CRC correctness still belong to Jimp;
the guard is not a full PNG decoder. Decode failures are caught at the actual
call site instead of becoming unhandled rejections. Normal tab creation and
the raw icon payload are preserved even if palette extraction is skipped.

`yarn test:icon-palette` checks zero parser calls for rejected input, decodes a
real generated 32x32 red PNG to RGB [252,4,4], and exercises the actual compiled
AppWindow.prepareContainer method with native window APIs isolated. It confirms
normal tab/color events and unchanged icon payloads, plus ASF rejection at the
real call site. It does not claim Windows/macOS GUI or native binding coverage.

Electron 8 is declared as a devDependency for packaging but is the actual
runtime of the distributed application, including its bundled Chromium/Node.
A production-only npm/Yarn filter cannot establish runtime safety. Its obsolete
runtime and the unverified GUI/native rebuild/installer paths remain explicit
limitations of this update; no broad Electron migration was performed.
