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

---

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

---

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

---

## Slave Setup

### Mock slave

No hardware? No problem. ZenScope ships with a Python XCP slave that simulates a real ECU on your local machine — full DAQ, memory read/write, the works.

**Prerequisites:** Python 3 (no extra packages needed — stdlib only).

Run it from the repo root:

```bash
python mock_slave.py
```

It listens on `127.0.0.1:5555` (UDP) and exposes 50 simulated variables across four categories:

| Category | Examples |
|---|---|
| Powertrain | engine RPM, throttle position, torque, gear position |
| Thermal | coolant temp, exhaust temp, oil temp, intake air temp |
| Electrical | battery voltage, alternator voltage, fuel pump duty |
| Sensors | lambda sensors, MAP sensor, injector pulse width |

Once it's running, open ZenScope, go to **Settings**, and set the connection to `127.0.0.1:5555` (UDP). Hit **Connect** — you should see the slave info appear and all 50 variables ready to DAQ.

### Hardware ECU

Connect your ECU directly to the PC running ZenScope via an Ethernet cable. Most ECUs don't need a switch or router in between — a direct connection works fine.

You'll need:
- The ECU's IP address and XCP port (check your ECU documentation)
- The transport protocol your ECU uses (UDP or raw Ethernet — when in doubt, start with UDP)

Open **Settings** in ZenScope and fill in the IP, port, and protocol, then hit **Connect**.

<!-- screenshot: /media/settings-hardware-ecu.png — Settings panel with connection fields filled in -->

::: tip Stick to UDP unless you have a reason not to
Raw Ethernet transport is only needed when the ECU expects proper source/destination MAC addresses in the XCP request packets. If your ECU documentation doesn't specifically call this out, UDP will work and is simpler to configure.
:::

For a full breakdown of every connection setting, see [Configuration](./configuration).

---

## Build from Source

_See [Contributing](../reference/contributing) for the full dev setup._
