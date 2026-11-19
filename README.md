# Spicetify Profile Switcher

A local multi-account switcher extension for Spotify desktop using Spicetify. It allows switching between multiple Spotify accounts directly from the top bar without re-entering login credentials.

---

## Features

- **Account Switching**: Switch between saved Spotify accounts without re-entering passwords or completing two-factor authentication.
- **Profile Picture Support**: Automatically retrieves and saves account avatar images alongside usernames.
- **Zero Resource Consumption**: Does not run active background scans, polling loops, or file monitors. When idle or when accounts are not being switched, it consumes 0% CPU and zero system resources.
- **Session Preservation**: Backs up active session tokens before switching to prevent sessions from expiring.

---

## Requirements

- **Spotify Desktop** (Windows)
- **Spicetify CLI** (v2.x or later)
- **Node.js** (v18 or later)

---

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/spicetify-profile-switcher.git
   cd spicetify-profile-switcher
   ```
2. Run `install.bat`.
3. Open Spotify. The Profile Switcher button will be available in the top bar.

The installer copies the extension into your Spicetify extensions directory, configures a startup entry for the background helper, and runs `spicetify apply`.

---

## Usage

### Saving the Current Account
1. Open Spotify and click the **Profile Switcher** icon in the top navigation bar.
2. Click **Save Current Account**.
3. Enter a label for the profile (e.g., `Main` or `Work`). Spotify will briefly restart to store the session data.

### Adding Another Account
1. Open the Profile Switcher menu and click **Add Another Account**.
2. Confirm the prompt. Spotify will sign out and return to the login screen.
3. Sign in with your second account.
4. Click the Profile Switcher icon and select **Save Current Account** to store it.

### Switching Accounts
Open the Profile Switcher menu and click **Switch** next to the desired profile. Spotify will restart logged into that account.

---

## Troubleshooting

### If the Helper Shows as Offline

If the Profile Switcher modal displays a warning stating that the local helper service is offline:

1. **Start the Helper Manually**:
   - Press `Win + R`, paste the following path, and press Enter:
     ```
     wscript.exe "%USERPROFILE%\.spotify-profiles\start-server.vbs"
     ```
   - Alternatively, navigate to `%USERPROFILE%\.spotify-profiles` and double-click `start-server.vbs`.

2. **Verify Node.js is Installed**:
   - Open Command Prompt or PowerShell and run:
     ```bash
     node -v
     ```
   - If Node.js is not recognized, install it from [nodejs.org](https://nodejs.org/).

3. **Re-run the Installer**:
   - Run `install.bat` from this repository again. It will re-register the Windows startup entry and relaunch the helper process.

4. **Verify Port Availability**:
   - The helper listens on `127.0.0.1:45821`. Ensure no other application or firewall rule is blocking this local port.

---

## How It Works

Spotify stores its login credentials and user storage files in:
- `%APPDATA%\Spotify\prefs`
- `%APPDATA%\Spotify\Users`
- `%LOCALAPPDATA%\Spotify\Users`

This project consists of two components:
1. **Extension (`profile-switcher.js`)**: Injects the switcher interface into Spotify, tracks profile labels and avatars, and sends switch commands.
2. **Helper Service (`server.js`)**: A local listener on `127.0.0.1:45821`. It is strictly passive and does not perform background monitoring or polling. It wakes up only when an account switch is triggered, closes Spotify, swaps the target session files in AppData, relaunches Spotify, and immediately goes back to sleep. When Spotify is closed or idle, it consumes no system resources.

---

## Uninstallation

Run `uninstall.bat` to disable the Spicetify extension and remove the helper from Windows startup.

---

## License

MIT License
