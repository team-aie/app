# aie

[![CI/CD](https://github.com/team-aie/app/actions/workflows/cicd.yml/badge.svg)](https://github.com/team-aie/app/actions/workflows/cicd.yml)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/team-aie/app.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/team-aie/app/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/team-aie/app.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/team-aie/app/context:javascript)

A cross-platform audio recorder designed for recording using recording lists (a.k.a. reclists). Recording lists are
lists of symbols that denote phonemes to be recorded by human voice suppliers. They are frequently used in the
production of voice banks.

## Download

The latest release page is located [here](https://github.com/team-aie/app/releases/latest). Look for the respective file
name for your platform: 1

- Windows: `aie-setup-x.y.z.exe`
- macOS: `aie-x.y.z.dmg`
- Linux: `aie.AppImage`

## Usage Notes

### Linux

If you are on a Linux distro, please consider using
[`AppImageLauncher`](https://github.com/TheAssassin/AppImageLauncher) to execute the `.AppImage` file. Alternatively,
you can use [`appimaged`](https://github.com/AppImage/appimaged) or simply make the file executable and run it (though
you will lose some benefits, including seeing the app icon).

## Developer Setup

### Build for Windows

You need to install [Wine](https://wiki.winehq.org/). On macOS, you can install via [HomeBrew](https://brew.sh/):

```bash
# xquartz is the dependency of wine-stable
brew cask install xquartz wine-stable
```
