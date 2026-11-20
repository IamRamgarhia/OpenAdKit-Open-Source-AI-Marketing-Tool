# winget package — `DiceCodes.OpenAdKit`

Lets Windows users install and update OpenAdKit with:

```powershell
winget install DiceCodes.OpenAdKit
winget upgrade DiceCodes.OpenAdKit
```

The manifests in `manifests/d/DiceCodes/OpenAdKit/<version>/` follow the
layout of [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
(same format as `DiceCodes.FreeGSTBilling`). They pass `winget validate`.

## Submitting a version (after the GitHub release is PUBLISHED)

winget's validation downloads the installer, so the release must be public
and `InstallerSha256` must match the published `OpenAdKit-Windows-Setup.exe`
(take it from the release's `SHA256SUMS.txt`).

```powershell
# 1. check the manifests
winget validate --manifest packaging\winget\manifests\d\DiceCodes\OpenAdKit\2.0.1

# 2. optional: test-install from the local manifest (needs admin once:
#    winget settings --enable LocalManifestFiles)
winget install --manifest packaging\winget\manifests\d\DiceCodes\OpenAdKit\2.0.1

# 3. copy the folder into your fork of microsoft/winget-pkgs
#    (github.com/IamRamgarhia/winget-pkgs) on a new branch, commit, open a PR
#    titled "New package: DiceCodes.OpenAdKit version 2.0.1".
```

## Later versions

With Microsoft's `wingetcreate` (`winget install Microsoft.WingetCreate`):

```powershell
wingetcreate update DiceCodes.OpenAdKit --version 2.0.2 `
  --urls https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/download/v2.0.2/OpenAdKit-Windows-Setup.exe `
  --submit
```

It downloads the installer, computes the hash and opens the PR for you.
Keep a copy of the new manifests here for reference.

Notes: per-user Inno Setup install (`Scope: user`, no admin), `ProductCode`
`OpenAdKit_is1` (from `AppId=OpenAdKit` in `installer/openadkit.iss`).
