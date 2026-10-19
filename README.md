<p align="center">
  <img src="static/app-icons/icon.png" width="256">
</p>

<div align="center">
  <h1>Multrin</h1>

[![Travis](https://img.shields.io/travis/com/sentialx/multrin.svg?style=flat-square)](https://travis-ci.com/sentialx/multrin)
[![Downloads](https://img.shields.io/github/downloads/sentialx/multrin/total.svg?style=flat-square)](https://github.com/sentialx/multrin/releases)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fsentialx%2Fmultrin.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fsentialx%2Fmultrin?ref=badge_shield)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-brightgreen?style=flat-square)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=VCPPFUAL4R6M6&source=url)
[![Discord](https://discordapp.com/api/guilds/307605794680209409/widget.png?style=shield)](https://discord.gg/P7Vn4VX)

Multrin is a cross-platform app built on Electron that lets you to organize apps in tabs by simply dropping them onto Multrin. It aims to greatly improve your productivity and organization.

</div>

> NOTE: Multrin works currently only on Windows and macOS. Support for Linux coming soon.

# Features

- Dark theme
- <kbd>Ctrl</kbd>+<kbd>Tab</kbd> keyboard shortcut to change selected tab

# Screenshots

![gif](https://user-images.githubusercontent.com/11065386/62975420-96351880-be1a-11e9-9b95-fa63b970620a.gif)

![image](https://user-images.githubusercontent.com/11065386/62975121-ff685c00-be19-11e9-81cb-073c97bf61d9.png)

# [Roadmap](https://github.com/sentialx/multrin/projects)

# Components

Multrin has some very important components:

- Tabs from [Wexond](https://github.com/wexond/wexond)
- [`node-window-manager`](https://github.com/sentialx/node-window-manager) for managing the docked windows

# Contributing

If you have found any bugs or just want to see some new features in Multrin, feel free to open an issue. I'm open to any suggestions and bug reports would be really helpful for me and appreciated very much. Multrin is in heavy development and some bugs may occur. Also, please don't hesitate to open a pull request. This is really important to me and for the further development of this project.

## Running

Before running Multrin in development mode, please ensure you have [`Node.js`](https://nodejs.org/en/) installed on your machine.

Use Node.js 24 LTS (minimum 22.13), Python 3, and native build tools.
On Windows install Visual Studio Build Tools with the Desktop development with
C++ workload. On macOS install Xcode Command Line Tools (`xcode-select --install`).
Electron 44 requires macOS 13 or later; desktop packages are 64-bit only.

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

For development, run `npm run watch`, then `npm start` in another terminal.
The development server binds only to loopback. Rebuilds are automatic; reload the
window after editing renderer code. For a local unsigned package, run
`npm run package`. Packaging commands never publish automatically.

On macOS, global window dragging needs Accessibility permission. The existing
system prompt opens on launch; input monitoring starts only after access has
been granted. Native modules can be rebuilt with `npm run rebuild`.

Existing settings stay in `~/.multrin/settings.json`. See
[DEPENDENCY-SECURITY.md](DEPENDENCY-SECURITY.md) for migration and verification details.

### Sponsors

[![Sponsors](https://opencollective.com/multrin/tiers/sponsor.svg?avatarHeight=48)](https://opencollective.com/multrin)

### Backers

[![Backers](https://opencollective.com/multrin/tiers/backer.svg?avatarHeight=48)](https://opencollective.com/multrin)

<a href="https://www.patreon.com/bePatron?u=12270966">
    <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="160">
</a>

## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fsentialx%2Fmultrin.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fsentialx%2Fmultrin?ref=badge_large)
