# JSON Tree Editor

[![CI](https://github.com/llerandi/json-tree-editor/actions/workflows/ci.yaml/badge.svg)](https://github.com/llerandi/json-tree-editor/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri v1](https://img.shields.io/badge/tauri-v1-blue?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/rust-stable-orange?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey)](#building-for-production)

A desktop app for building and editing JSON files visually. Fields are shown as draggable boxes. Indentation reflects the nesting level in the JSON structure. Drag a box to a different level and it moves there in the output file.

Built with [Tauri](https://tauri.app/) (Rust backend, plain HTML/JS frontend).

---

## How it works

- Each box represents a key-value pair.
- Indentation shows how deep the field is in the JSON.
- Change the type of a field (string, number, boolean, null, object, array) using the dropdown.
- Fields of type `object` or `array` can contain other fields as children.
- Drag the handle on the left of any box to reorder or re-nest it.
  - Drop in the **top third** of a row to place the field before it.
  - Drop in the **bottom third** of a container row to make it a child.
  - Drop in the **middle** to place it after.
- Use **Open JSON** to load an existing file and edit it.
- Use **Save JSON** to write the result to disk using a native save dialog.
- The **Preview** panel shows the resulting JSON in real time.

![JSON Tree Editor screenshot](docs/img/app.png)

---

## Prerequisites

You need three things installed before you can build or run this project:

1. **Rust** -- the language the backend is written in.
2. **Tauri CLI** -- the command-line tool that builds and runs the app.
3. Platform-specific **system dependencies** -- listed below per operating system.

### Install Rust

Go to [https://rustup.rs](https://rustup.rs) and follow the instructions for your platform. This installs both `rustup` and `cargo`.

After installing, close and reopen your terminal, then verify it worked:

```
rustc --version
```

### Install the Tauri CLI

Once Rust is installed, run:

```
cargo install tauri-cli --version "^1.0" --locked
```

This downloads and compiles the CLI. It may take a few minutes the first time.

---

## Platform setup

### Windows

1. Install **Microsoft Visual Studio C++ Build Tools**.
   - Download the installer from [https://visualstudio.microsoft.com/visual-cpp-build-tools](https://visualstudio.microsoft.com/visual-cpp-build-tools)
   - Run it and select the **"Desktop development with C++"** workload.
   - Finish the installation.

2. **WebView2** is the browser engine Tauri uses on Windows. It comes pre-installed on Windows 10 (version 1803 and later) and Windows 11. If you are on an older version, download it from [https://developer.microsoft.com/microsoft-edge/webview2](https://developer.microsoft.com/microsoft-edge/webview2).

---

### macOS

Install the Xcode command line tools. Open Terminal and run:

```
xcode-select --install
```

A dialog will appear asking you to confirm. Click **Install** and wait for it to finish.

---

### Linux

Install the system packages that Tauri needs. The exact command depends on your distribution.

**Ubuntu 22.04 / Debian:**

```
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Fedora:**

```
sudo dnf install webkit2gtk3-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
sudo dnf group install "C Development Tools and Libraries"
```

**Arch Linux:**

```
sudo pacman -Syu webkit2gtk \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg
```

---

## Getting the code

```
git clone https://github.com/llerandi/json-tree-editor.git
cd json-tree-editor
```

---

## Running in development

Start the app in development mode. The window opens immediately and reloads when you save changes to `src/index.html` or `src/main.js`.

```
cargo tauri dev
```

The first run compiles all Rust dependencies, which takes a few minutes. Subsequent runs are much faster.

---

## Building for production

To compile a release build and create an installable package for your platform:

```
cargo tauri build
```

The output is placed in `src-tauri/target/release/bundle/`.

- **Windows**: produces an `.msi` installer and an `.exe` in `msi/` and `nsis/`.
- **macOS**: produces a `.dmg` disk image and a `.app` bundle in `dmg/` and `macos/`.
- **Linux**: produces a `.deb` package and an `.AppImage` in `deb/` and `appimage/`.

---

## Project structure

```
json-tree-editor/
├── docs/
│   └── img/
│       └── app.png         # Screenshot used in this README
├── src/
│   ├── index.html          # HTML structure and styles
│   └── main.js             # All application logic
├── src-tauri/
│   ├── icons/              # App icons for all platforms
│   ├── src/
│   │   └── main.rs         # Entry point: starts the Tauri event loop
│   ├── build.rs            # Build-time code generation required by Tauri
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # App name, window size, permissions, bundle settings
├── .gitignore
└── README.md
```

To replace the app icon, run `cargo tauri icon your-image.png` with a square PNG of at least 1024x1024 pixels.

---

## License

MIT. See [LICENSE](LICENSE) for the full text.
