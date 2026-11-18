const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const PORT = 45821;
const USERPROFILE = process.env.USERPROFILE || process.env.HOME || '';
const PROFILES_DIR = path.join(USERPROFILE, '.spotify-profiles');
const ROAMING_SPOTIFY = path.join(process.env.APPDATA || path.join(USERPROFILE, 'AppData', 'Roaming'), 'Spotify');
const LOCAL_SPOTIFY = path.join(process.env.LOCALAPPDATA || path.join(USERPROFILE, 'AppData', 'Local'), 'Spotify');
const SPOTIFY_EXE = path.join(ROAMING_SPOTIFY, 'Spotify.exe');

if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
        fs.appendFileSync(path.join(PROFILES_DIR, 'server.log'), line, 'utf8');
    } catch (e) {}
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function killSpotify() {
    return new Promise((resolve) => {
        log('Killing Spotify.exe...');
        exec('taskkill /F /IM Spotify.exe /T', () => {
            setTimeout(resolve, 800);
        });
    });
}

function startSpotify() {
    log('Starting Spotify...');
    try {
        if (fs.existsSync(SPOTIFY_EXE)) {
            const child = spawn(SPOTIFY_EXE, [], { detached: true, stdio: 'ignore' });
            child.unref();
        } else {
            exec('cmd.exe /c start spotify:');
        }
        log('Spotify started.');
    } catch (e) {
        log(`Error starting Spotify: ${e.message}`);
    }
}

function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        for (const item of fs.readdirSync(src)) {
            copyRecursiveSync(path.join(src, item), path.join(dest, item));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

function removeDirSync(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

function getCurrentUsernameFromPrefs() {
    try {
        const prefsFile = path.join(ROAMING_SPOTIFY, 'prefs');
        if (fs.existsSync(prefsFile)) {
            const lines = fs.readFileSync(prefsFile, 'utf8').split('\n');
            for (const line of lines) {
                if (line.startsWith('autologin.username=')) {
                    return line.split('=')[1].replace(/["\r]/g, '').trim();
                }
            }
        }
    } catch (e) {}
    return null;
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const query = parsed.query;

    log(`HTTP ${req.method} ${req.url}`);

    try {
        if (pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', port: PORT }));
            return;
        }

        if (pathname === '/profiles') {
            const dirs = fs.readdirSync(PROFILES_DIR, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);

            const profiles = [];
            for (const name of dirs) {
                const metaFile = path.join(PROFILES_DIR, name, 'meta.json');
                if (fs.existsSync(metaFile)) {
                    try {
                        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                        profiles.push(meta);
                    } catch (e) {
                        profiles.push({ name, displayName: name });
                    }
                } else {
                    profiles.push({ name, displayName: name });
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(profiles));
            return;
        }

        if (pathname === '/save') {
            const name = (query.name || '').trim();
            const displayName = query.displayName || name;
            const username = query.username || name;
            const avatar = query.avatar || '';

            if (!name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing profile name' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Saving ${name}` }));

            (async () => {
                log(`Executing /save for: ${name}`);
                await killSpotify();
                await sleep(600);

                const targetDir = path.join(PROFILES_DIR, name);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Copy prefs
                const prefsFile = path.join(ROAMING_SPOTIFY, 'prefs');
                if (fs.existsSync(prefsFile)) {
                    fs.copyFileSync(prefsFile, path.join(targetDir, 'prefs'));
                    log(`Copied prefs to ${targetDir}`);
                }

                // Copy Roaming Users
                const roamingUsers = path.join(ROAMING_SPOTIFY, 'Users');
                if (fs.existsSync(roamingUsers)) {
                    const dest = path.join(targetDir, 'RoamingUsers');
                    removeDirSync(dest);
                    copyRecursiveSync(roamingUsers, dest);
                    log('Copied Roaming Users');
                }

                // Copy Local Users
                const localUsers = path.join(LOCAL_SPOTIFY, 'Users');
                if (fs.existsSync(localUsers)) {
                    const dest = path.join(targetDir, 'LocalUsers');
                    removeDirSync(dest);
                    copyRecursiveSync(localUsers, dest);
                    log('Copied Local Users');
                }

                // Save meta
                const meta = {
                    name,
                    displayName,
                    username,
                    avatar,
                    savedAt: new Date().toISOString()
                };
                fs.writeFileSync(path.join(targetDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
                log(`Saved metadata for profile: ${name}`);

                await sleep(600);
                startSpotify();
            })();
            return;
        }

        if (pathname === '/switch') {
            const name = (query.name || '').trim();
            const targetDir = path.join(PROFILES_DIR, name);

            if (!name || !fs.existsSync(targetDir)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Profile directory not found' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Switching to ${name}` }));

            (async () => {
                log(`Executing /switch to: ${name}`);
                const currentUsername = getCurrentUsernameFromPrefs();
                if (currentUsername) {
                    const dirs = fs.readdirSync(PROFILES_DIR, { withFileTypes: true })
                        .filter(d => d.isDirectory())
                        .map(d => d.name);

                    for (const d of dirs) {
                        const mFile = path.join(PROFILES_DIR, d, 'meta.json');
                        if (fs.existsSync(mFile)) {
                            try {
                                const m = JSON.parse(fs.readFileSync(mFile, 'utf8'));
                                if (m.username === currentUsername && m.name !== name) {
                                    log(`Auto-updating current profile before switch: ${m.name}`);
                                    const prefsFile = path.join(ROAMING_SPOTIFY, 'prefs');
                                    if (fs.existsSync(prefsFile)) {
                                        fs.copyFileSync(prefsFile, path.join(PROFILES_DIR, m.name, 'prefs'));
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                }

                await killSpotify();
                await sleep(600);

                // Restore target prefs
                const savedPrefs = path.join(targetDir, 'prefs');
                if (fs.existsSync(savedPrefs)) {
                    fs.copyFileSync(savedPrefs, path.join(ROAMING_SPOTIFY, 'prefs'));
                    log('Restored target prefs');
                }

                // Restore target Roaming Users
                const savedRoamingUsers = path.join(targetDir, 'RoamingUsers');
                if (fs.existsSync(savedRoamingUsers)) {
                    const dest = path.join(ROAMING_SPOTIFY, 'Users');
                    removeDirSync(dest);
                    copyRecursiveSync(savedRoamingUsers, dest);
                    log('Restored target Roaming Users');
                }

                // Restore target Local Users
                const savedLocalUsers = path.join(targetDir, 'LocalUsers');
                if (fs.existsSync(savedLocalUsers)) {
                    const dest = path.join(LOCAL_SPOTIFY, 'Users');
                    removeDirSync(dest);
                    copyRecursiveSync(savedLocalUsers, dest);
                    log('Restored target Local Users');
                }

                log(`Restoration of ${name} complete.`);
                await sleep(600);
                startSpotify();
            })();
            return;
        }

        if (pathname === '/new') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Opening login screen' }));

            (async () => {
                log('Executing /new: Resetting credentials to show login screen...');
                await killSpotify();
                await sleep(600);

                const prefsFile = path.join(ROAMING_SPOTIFY, 'prefs');
                if (fs.existsSync(prefsFile)) {
                    const lines = fs.readFileSync(prefsFile, 'utf8').split(/\r?\n/);
                    const filtered = lines.filter(l => !l.trim().startsWith('autologin.'));
                    fs.writeFileSync(prefsFile, filtered.join('\n'), 'utf8');
                    log('Stripped autologin keys from prefs.');
                }

                await sleep(600);
                startSpotify();
            })();
            return;
        }

        if (pathname === '/delete') {
            const name = (query.name || '').trim();
            const targetDir = path.join(PROFILES_DIR, name);
            if (fs.existsSync(targetDir)) {
                removeDirSync(targetDir);
                log(`Deleted profile ${name}`);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch (err) {
        log(`Server error: ${err.stack || err}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    log(`Profile Switcher server listening on http://127.0.0.1:${PORT}`);
});
