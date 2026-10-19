# Dependency security maintenance (2026-10-19)

This migration supersedes the 2026-10-18 mitigation. The old Electron 8,
webpack 4, iohook/request installer and node-vibrant/Jimp/file-type trees have
been removed from the real dependency graph. npm's lockfile is the single
package-manager source; use `npm ci` rather than Yarn.

## Runtime and compatibility

- Electron 44.9.0 replaces Electron 8. Official Electron 44 support ends on
  2027-03-02. macOS 13+ and 64-bit operating systems are now required.
- uiohook-napi 1.5.5 provides N-API global input monitoring. `input-hook.ts`
  preserves the application's mousedown/mousedrag/mouseup string event types,
  screen coordinates, ordered release and EventEmitter once semantics. Native,
  activation and IPC listeners are released when their window closes, and late
  callbacks guard against destroyed windows. Only
  left-button drags capture windows. On macOS monitoring waits for the existing
  Accessibility grant; permissions are not bypassed or changed by tests.
- node-window-manager 2.2.4 and extract-file-icon 0.3.2 retain the native window
  operations. They compile from source for the target architecture.
- PNG-only pngjs 7 decoding replaces generic image sniffing. Bounded input,
  dimensions, structure and CRC checks reject malformed icons. A separable area
  downsample preserves the legacy Vibrant quality-5 behavior; the maintained
  Vibrant 4 MMCQ quantizer/generator preserve tab color selection. The native
  executable icon fixture remains exactly `#639b7f`; RGB, transparency, 1px,
  corrupt CRC and ASF regressions are included. No Jimp/file-type decoder is
  installed. Icons remain displayed even if palette extraction fails.
- Existing React 16/MobX 5 UI behavior and `~/.multrin/settings.json` are retained.
  TypeScript checks application code without `skipLibCheck`. The documented
  Windows-controls type path avoids that package's broken root reference while
  runtime imports continue to use its original bundle.

## PNG allocation boundary and populated-tab regression

QA found that pngjs 7's public sync decoder limits ordinary PNG inflation but
calls unbounded `inflateSync` for Adam7. The icon path now composes unchanged
pngjs 7.0.0 `parser`, `sync-reader`, `filter-parse-sync`, `bitmapper` and
`format-normaliser` stages with a local bounded inflation step. No npm package
source is patched or vendored, and the real package remains in the audited
lockfile. These private stage APIs are version-pinned and exercised by decoder
regressions; upgrading pngjs requires reviewing this integration.

The local wrapper validates legal color-type/bit-depth pairs and dimensions,
rejects duplicate headers, derives the exact scanline length (including filter
bytes and per-pass byte padding) from the W3C Adam7 geometry, and calls Node
`inflateSync` with `maxOutputLength` equal to that budget for every PNG. It also
rejects short output before filtering. At the 512x512 RGBA16 maximum, the
Adam7 budget is 2,098,112 bytes; a 1x1 RGBA8 image gets a 5-byte budget. QA's
CRC-valid 16 MiB expanded stream is rejected with `ERR_BUFFER_TOO_LARGE`
before that output is materialized. Input is copied before decoding to keep
shared/mutable buffers from changing metadata during the decode pipeline.

Tests retain normal Adam7 RGBA8/RGBA16, packed paletted/grayscale and RGB/alpha
images, and reject extra/short bytes, duplicate headers, invalid formats, CRC
errors and the inflated bomb. Ordinary PNG and the legacy native-icon color
fixture remain unchanged. Sources for the bound:
[W3C PNG interlacing](https://www.w3.org/TR/png-3/#8Interlace) and
[Node zlib maxOutputLength](https://nodejs.org/download/release/latest-jod/docs/api/zlib.html).

QA also reproduced an empty renderer after adding a real window: the inherited
color helper stored its parser on `this`, but strict bundled modules invoke it
unbound. The parser is now module-local and preserves the blend calculation.
A regression exercises unbound RGB/hex/alpha calls. The GUI helper adds two
owned real native fixtures, verifies renderer selection through actual handlers
and IPC, native raising/geometry, escaped and updated titles, Blob icon and
computed palette color, settings roundtrip and normal close. macOS's existing
native manager does not implement opacity APIs; the test explicitly reports
that capability as false and verifies native selection/raising instead.

## Build dependencies and the one override

Webpack 5, TypeScript 5.9, ESLint 10, builder 26.15 and updater 6.8 replace the
legacy toolchain. The old development server's unpatched braces/micromatch
chain is replaced with a small Node HTTP server: loopback binding, Host checks,
allowed methods and MIME types, realpath containment and symlink protection.
Webpack watch still rebuilds automatically; renderer reload is manual.

`@electron/get` is overridden to 5.1.0 throughout the tree. Builder's older
transitive get 3 pulls global-agent/roarr/sprintf-js, whose precision DoS has no
patched release. get 5 removes that chain and exposes the downloadArtifact,
ElectronDownloadCacheMode and related APIs used by builder. Node >=22.13
supports its ESM interop. The actual Electron download, native rebuild and
unsigned arm64 app package succeeded with this override. It is not an audit
ignore, inert resolution or warning dismissal.

The old installer multipart test covered only iohook -> nugget -> request.
That downloader no longer exists; its specialized test is retired with it.
Input event regressions, native loads and GUI/package checks replace validation
of the real functionality. This also removes the old test server's reflected
error-message response reported by CodeQL.

## Privileged renderer trust boundary

The existing application uses Node integration and the official
`@electron/remote` replacement for removed Electron remote APIs. Context
isolation and sandboxing remain disabled for these legacy views. Each window
is confined to its exact bundled file URL, including packaged app.asar URLs;
remote is enabled only for those application windows. External navigation,
redirects, popups, webview attachment and permission requests are denied.

The only development document origin is `http://localhost:4444`, served by the
loopback-only asset server. Development assumes trusted local source and a
trusted local account; do not run a privileged development build against
untrusted source or a substituted local service.

Source inspection found no dangerouslySetInnerHTML, innerHTML, eval, new
Function, external document loading, iframe or shell.openExternal call.
Native and edited tab titles render as React text, which escapes markup. Icon
bytes become Blob URLs rather than HTML or an external URL. Font/style
textContent values use bundled assets. User-selected window icons are opened
as local nativeImage paths. No remote document is deliberately granted Node.

## Verification

On macOS 27.2 arm64, host Node **22.23.1**, npm **10.9.8**:

- clean `npm ci --foreground-scripts`, including native compilation: passed;
- full `npm audit --json`: **0 vulnerabilities**, production and development;
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`: passed;
- Electron 44.9.0 / embedded Node 24.22.0 real GUI: main and menu render, remote
  window lookup, pre-existing settings read/preservation, external popup denial;
- real OS mouse down/drag/up events traverse the native hook and adapter with
  expected coordinates and ordering, inside the disposable smoke window;
- native window enumeration and icon extraction load on the actual Electron
  runtime; unsigned arm64 packaging rebuilds native modules against Electron;
- packaged binary loads `app.asar/build/app.html`, retains the settings fixture,
  supports remote window lookup, loads native window operations and blocks
  external popups. No signing, release upload or publication was performed.

Smoke helpers create their own private temporary HOME and evidence directory;
no output directory or executable path is accepted from argv/environment.
Evidence names have a fixed allowlist and exclusive creation prevents overwrites.
The package smoke chooses its executable from a platform/architecture allowlist,
verifies realpath containment under this repository's dist, and rejects redirected
dist directories and escaping artifact symlinks. It spawns an argument array with
shell disabled. Traversal, absolute paths, symlink escape, overwrite attempts and
untrusted executable arguments have regressions.

Run `MULTRIN_SMOKE_NATIVE_MOUSE=1 npx electron tests/gui-smoke.cjs` on macOS
for the isolated GUI/native check, then `node tests/package-smoke.cjs` after
packaging. Each command prints the evidence directory it created. The Windows
URL regression forces both Windows drive-letter and POSIX app.asar paths on
every host; it does not assume the host's file URL format.

The macOS and Windows CI matrix uses Node 24, clean install, full audit, tests,
typecheck, lint and a local package. Windows native/GUI operation is not claimed
from the local macOS run; CI provides the corresponding build checks. Automatic
update installation against a real release server is not exercised.

Rollback: restore the preceding release if necessary; keep a copy of
`~/.multrin/settings.json`. No data migration or destructive settings rewrite
is required. Do not publish a rollback containing the retired vulnerable
runtime as a new supported release.

Sources:
- https://releases.electronjs.org/schedule
- https://releases.electronjs.org/release/v44.0.0
- https://www.electronjs.org/docs/latest/breaking-changes
- https://github.com/electron/remote
- https://github.com/SnosMe/uiohook-napi
- https://github.com/electron/get
- https://github.com/advisories/GHSA-hp3w-g68c-fv3c
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
