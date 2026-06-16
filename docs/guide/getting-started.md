# Getting Started

## Windows

### Prerequisites

- Windows 10 or 11 (64-bit)
- [Npcap](https://npcap.com/#download) — needed for raw Ethernet transport. Run the Npcap installer with the default options before launching ZenScope.

### Install

Head to the [latest release](https://github.com/Dheeps02/xcaliber/releases/latest) and grab whichever package suits you:

- **Setup (`ZenScope-Setup.exe`)** — installs ZenScope to `Program Files` with a Start Menu entry. Run the installer and follow the wizard. Windows may pop up a warning saying the app is from an unknown publisher — click **More info → Run anyway**.
- **Portable (`.zip`)** — extract anywhere and run `ZenScope.exe` directly. No installation needed.

### Launch

Open ZenScope from the Start Menu, your desktop shortcut, or directly from the extracted folder. The backend starts automatically — there's nothing else to run.

## Linux

### Prerequisites

- **libfuse2** — required to run AppImages. Install it if you don't have it:

  ```bash
  # Debian / Ubuntu
  sudo apt install libfuse2

  # Fedora
  sudo dnf install fuse

  # Arch
  sudo pacman -S fuse2
  ```

- **Raw Ethernet only:** raw socket access requires `CAP_NET_RAW`. You can either run ZenScope with `sudo`, or grant the capability directly to the binary (recommended):

  ```bash
  sudo setcap cap_net_raw+ep /path/to/ZenScope.AppImage
  ```

  UDP mode works without any of this.

### Install

1. Download `ZenScope-x86_64.AppImage` from the [latest release](https://github.com/Dheeps02/xcaliber/releases/latest).
2. Make it executable:

   ```bash
   chmod +x ZenScope-x86_64.AppImage
   ```

### Launch

```bash
./ZenScope-x86_64.AppImage
```

The backend starts automatically alongside the app.

## macOS

### Prerequisites

- macOS 12 Monterey or later (Intel and Apple Silicon both supported)
- **Raw Ethernet only:** raw packet capture requires root access. Run ZenScope with `sudo` if you're using raw Ethernet transport. UDP mode works without it.

::: details Advanced: skip sudo with ChmodBPF
macOS uses BPF devices (`/dev/bpf*`) for raw socket access. By default only root can open them. [ChmodBPF](https://formulae.brew.sh/cask/wireshark) — bundled with Wireshark — installs a launch daemon that grants BPF access to a dedicated group, so you can run ZenScope as a normal user:

```bash
brew install --cask wireshark   # installs ChmodBPF as a side effect
sudo dseditgroup -o edit -a $(whoami) -t user access_bpf
```

Log out and back in. ZenScope will now open raw sockets without `sudo`.
:::

### Install

1. Download `ZenScope-universal.dmg` from the [latest release](https://github.com/Dheeps02/xcaliber/releases/latest).
2. Open the DMG and drag **ZenScope** to your **Applications** folder.

### Launch

Right-click ZenScope in Applications and choose **Open**. On first launch macOS will warn you the app is from an unidentified developer — clicking **Open** in that dialog bypasses the check permanently for this app. After that, you can open it normally.

The backend starts automatically alongside the app.

## Build from Source

_See [Contributing](../reference/contributing) for the full dev setup._
