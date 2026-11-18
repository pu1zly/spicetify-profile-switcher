# Spicetify Profile Switcher 🔄

A dedicated, fast, local multi-account switcher for Spotify desktop via [Spicetify](https://spicetify.app/).

Switch between multiple Spotify accounts seamlessly in **1 click** directly from Spotify's top bar without logging out manually or typing passwords.

---

## ✨ Features

- **⚡ 1-Click Account Switching**: Instant account swapping without having to re-enter credentials or solve 2FA every time.
- **🖼️ Profile Pictures Supported**: Automatically discovers and saves each account's avatar image alongside its name and user ID.
- **🎨 Native Spotify UI**: Frosted glassmorphism modal with rounded corners, subtle elevation borders, and no intrusive scrollbars.
- **🔄 Auto-Syncing Sessions**: Automatically updates active refresh tokens before swapping, ensuring sessions never expire unexpectedly.
- **🔇 Silent Local Helper**: Runs silently in the background on Windows (`~15MB RAM`, 0% CPU) and auto-starts on login.

---

## 📋 Prerequisites

- **[Spotify Desktop](https://www.spotify.com/download/)** (Standard desktop app)
- **[Spicetify CLI](https://spicetify.app/)** (`v2.x`+)
- **[Node.js](https://nodejs.org/)** (`v18` or higher)

---

## 🚀 Quick Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/spicetify-profile-switcher.git
   cd spicetify-profile-switcher
   ```
2. Double-click **`install.bat`** (or run it in Command Prompt / PowerShell).
3. Open Spotify — you will see the **Profile Switcher** icon in your top bar!

---

## 📖 How to Use

1. **Save Your Current Account**:
   - Open Spotify and click the **Profile Switcher** icon in the top bar.
   - Click **`💾 Save Current Account`** and give it a label (e.g. `Personal` or `Main`).
   - Spotify will quickly restart to snapshot your active session.

2. **Add Your Other Accounts**:
   - Open the Profile Switcher again and click **`➕ Add Another Account`**.
   - Spotify will sign out and display the Spotify Login screen.
   - Log into your second account.
   - Click the Profile Switcher icon and click **`💾 Save Current Account`** (e.g. `Work` or `Alt`).

3. **Switch Between Accounts**:
   - Simply click the top bar icon, click **`Switch`** next to any saved profile, and Spotify will restart instantly logged into that account.

---

## 🛠️ How It Works Under the Hood

Spotify desktop stores its login tokens and active session credentials locally inside:
- `%APPDATA%\Spotify\prefs`
- `%APPDATA%\Spotify\Users`
- `%LOCALAPPDATA%\Spotify\Users`

This tool consists of two lightweight pieces:
1. **Spicetify Extension (`profile-switcher.js`)**: Injects a custom modal into Spotify's client interface, manages saved profile metadata, and triggers session switches.
2. **Local Helper Service (`server.js`)**: A tiny local HTTP daemon listening on `127.0.0.1:45821`. When triggered, it gracefully closes Spotify, swaps the target profile's session tokens into Spotify's AppData directories, and restarts Spotify.

---

## 🗑️ Uninstallation

Run `uninstall.bat` to disable the Spicetify extension and remove the auto-start background helper.

---

## 📄 License

MIT License. Feel free to modify and share!
