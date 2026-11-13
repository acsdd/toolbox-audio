# AudioWave widget review and safety plan

## Current boundary

The first AudioWave version offers only the first-party Mini Player. Its UI lives on the maintained ArtistWave HTTPS site and controls the single, existing playback session through the same-origin parent in an embedded frame. AudioWave denies the popup and resizes its existing window, so full and mini views are mutually exclusive. The local manager stores only whether that widget is installed. It does not download executable code.

The `toolbox-widgets` package used by the wider suite currently provides data, service logic and settings bundles. That format is not a UI-widget package format and does not authorize code execution in AudioWave.

## Before third-party widgets are supported

Outside widgets must remain unavailable until AudioWave has a signed package format, an isolated runtime, a capability permission model, and a documented review process. A listing in a registry or a successful malware scan is not enough to approve a widget.

### 1. Publisher and source

- Verify the publisher’s identity and a maintained source repository.
- Require a license, versioned source, release notes, a security contact, and a stable owner for updates.
- Reject opaque downloads, obfuscated code without reviewable source, mutable unversioned URLs, and packages whose provenance cannot be established.
- Pin each release to a cryptographic digest and a publisher signature checked against a key trusted by AudioWave.

### 2. Code and dependency review

- Review the complete source and dependency tree before approval, including install and update scripts.
- Require a lockfile, generate a software bill of materials, and scan dependencies and packaged files for known vulnerabilities and secrets.
- Review for data collection, credential access, filesystem access, process execution, unsafe deserialization, injection, remote-code loading, hidden network calls, and attempts to bypass the widget API.
- Build from the reviewed source in a clean environment and compare the result to the signed package. Reject unexplained build differences.
- Re-review every update. A clean prior version does not approve new code automatically.

### 3. Capability declaration and least privilege

Every widget must declare each capability it needs and why. The default is no access.

- `playback.read` and `playback.control` may be requested for player widgets.
- Network access must name exact HTTPS domains and a user-facing purpose. No arbitrary destination by default.
- File access must be selected by the user for specific files or folders; no full-disk access.
- Shell/process execution, credential-store access, silent clipboard reads, broad IPC, and background collection are denied for ordinary widgets.
- Show the requested capabilities before install and let the user remove them later.

### 4. Runtime isolation

- Run each widget in its own sandboxed renderer with `contextIsolation: true`, `nodeIntegration: false`, a restrictive Content Security Policy, and a dedicated storage partition.
- Expose only documented, schema-validated IPC methods for the approved capabilities. Never pass raw Electron, Node, filesystem paths, or unrestricted command execution into a widget.
- Deny navigation, popups, OS permissions, and protocol handlers by default. Open approved external links in the system browser.
- Keep widget code local and versioned after install. Do not execute JavaScript fetched from a website at runtime.
- Apply resource limits and allow the user to disable a widget without restarting AudioWave.

### 5. Verification before approval

For each release, record the reviewer, source commit, package digest, signature result, dependency findings, requested capabilities, and decision. Verify:

- installation, update, disable, removal, rollback, and clean reinstall;
- the widget cannot reach unapproved IPC, files, processes, origins, or system permissions;
- network destinations match the declaration;
- removal deletes widget code and offers clear handling for its saved data;
- no known critical or high-severity issue remains unresolved;
- a regression check passes against the supported AudioWave release.

A scan is one input to a human review, not a safety guarantee.

### 6. Release, monitoring, and revocation

- Publish only signed, immutable releases with a digest, source link, change log, license, and capability summary.
- Prompt users before updates that add capabilities. Do not silently install a changed package.
- Maintain a way to withdraw a listing, block a compromised signature, disable a widget, and roll back to a known-good version.
- Provide a private vulnerability-reporting path and a response owner. Revoke first if there is credible evidence of compromise, then investigate.
- Label review status accurately (for example: first-party, source-reviewed, signature-verified). Never describe a widget as guaranteed safe.

## Decision gate

Third-party support is ready for a prototype only after the signed package format, isolated execution model, capability prompts, review record, update/rollback path, and revocation controls all exist. Until then, keep the catalog first-party and bundled with AudioWave.