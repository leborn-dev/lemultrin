# CodeQL manual Swift build

The default Swift scan failed with `no-project-found`: this repository has no
Xcode workspace/project or Swift package. Its only tracked Swift source is
`tests/native-mouse.swift`, the standalone helper invoked through `/usr/bin/swift`
by the disposable Electron GUI smoke test. The source is valid Swift; running
`swiftc tests/native-mouse.swift -o /temporary/path/native-mouse` compiles it
successfully without moving the pointer or posting input events. The CodeQL job
compiles it and never executes the helper.

The advanced workflow retains JavaScript/TypeScript scanning in `none` build mode
on Linux and builds Swift explicitly in `manual` mode on macOS between CodeQL
initialization and analysis. If additional Swift programs are added, their normal
build commands must be added here too. The current compile command covers every
tracked `.swift` file. Each language retains its own analysis category. The job
can read source and upload security results; it cannot write repository contents.

Before relying on this workflow's result, the repository administrator must switch
code scanning from default setup to advanced setup. This change does not alter
that account setting. Re-run the reviewed PR workflow after switching, then verify
both language jobs and analyses at the same commit, including nonempty Swift
extraction/rules. A local compilation or JavaScript-only result is not evidence
that Swift code scanning succeeded.

Reference: [GitHub's manual compiled-language build guidance](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/codeql-for-compiled-languages#specify-build-steps-manually).
