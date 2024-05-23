# Allowed Tabs (Chrome/Edge Extension)

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)

## Install (Chrome/Edge)

1. Download zip file from github and uncompress to local.

2. Open Extensions (chrome://extensions) from chrome.

3. Choose `Load unpacked` (Open Develop Mode first)，click folder you just uncompressed, finish!

**Google Chrome**:
[Install it directly from the Chrome Web Store](https://chrome.google.com/webstore/detail/allowed-tabs/deglahadfhbjhkcphfhmanmjdmokhcaa).

**Microsoft Edge**:
[Install it directly from the Microsoft Store](https://microsoftedge.microsoft.com/addons/detail/bedgmdmofacooedgglodglabbelmekha).

## Changelog

`2024-05`
- Forcing an upper limit on the number of tag groups

`2024-02`
- Add pinned & grouped support(only locale in en & zh-CN)
- Update Manifest to V3.
- change all "chrome." to "chrome.||browser." to fit Firefox(no test yet)
- change "window.alert" to "window.confirm" (some URL like chrome:// and extension store, as well as switching active tabs won't show confirm window and close tab immediately)
- some errors is uncaught or showing up, but don't affect the extension's function

`2021-07`

Features:
- Creation of the extension.
- Translation and beautification of the popup.

## License

[allowed-tabs](https://github.com/fernandodilland/allowed-tabs/) are released under [MIT license](https://github.com/fernandodilland/allowed-tabs/blob/main/LICENSE) . Copyright (c) [Fernando Dilland](https://github.com/fernandodilland).
