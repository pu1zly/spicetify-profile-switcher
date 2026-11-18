// @ts-check
// NAME: Spotify Profile Switcher
// AUTHOR: Antigravity
// DESCRIPTION: Local multi-account switcher for Spotify via Spicetify

(function ProfileSwitcher() {
    if (!Spicetify.Topbar || !Spicetify.Platform || !Spicetify.PopupModal) {
        setTimeout(ProfileSwitcher, 300);
        return;
    }

    const SERVER_URL = "http://127.0.0.1:45821";

    async function checkServerStatus() {
        try {
            const res = await fetch(`${SERVER_URL}/status`, { cache: "no-store", signal: AbortSignal.timeout(1000) });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async function fetchProfiles() {
        try {
            const res = await fetch(`${SERVER_URL}/profiles`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
            if (res.ok) {
                const data = await res.json();
                Spicetify.LocalStorage.set("spotify_saved_profiles", JSON.stringify(data));
                return data;
            }
        } catch (e) {}

        try {
            return JSON.parse(Spicetify.LocalStorage.get("spotify_saved_profiles") || "[]");
        } catch (e) {
            return [];
        }
    }

    function resolveAvatarUrl(raw) {
        if (!raw) return "";
        if (raw.startsWith("spotify:image:")) {
            return "https://i.scdn.co/image/" + raw.replace("spotify:image:", "");
        }
        return raw;
    }

    async function getCurrentUserInfo() {
        let avatar = "";
        let username = "";
        let displayName = "";

        // 1. Scrape topbar avatar from Spotify's live DOM
        try {
            const avatarImg = 
                document.querySelector('[data-testid="user-widget-link"] img') ||
                document.querySelector('button[aria-label="User Profile"] img') ||
                document.querySelector('.main-userWidget-box img') ||
                document.querySelector('figure[data-testid="user-widget-avatar"] img') ||
                document.querySelector('button[data-testid="user-widget-link"] img') ||
                document.querySelector('img[alt="Avatar"]');

            if (avatarImg && /** @type {HTMLImageElement} */ (avatarImg).src) {
                const src = /** @type {HTMLImageElement} */ (avatarImg).src;
                if (!src.startsWith("data:") && (src.includes("scdn.co") || src.includes("spotifycdn") || src.startsWith("http"))) {
                    avatar = src;
                }
            }
        } catch (e) {}

        // 2. Query Platform APIs
        try {
            if (Spicetify.Platform?.UserAPI?.getUser) {
                const user = await Spicetify.Platform.UserAPI.getUser();
                username = user.username || user.id || "";
                displayName = user.displayName || user.name || "";
                if (!avatar) {
                    if (user.images && user.images.length > 0) {
                        const img = user.images[0].url || user.images[user.images.length - 1].url;
                        avatar = resolveAvatarUrl(img);
                    } else if (user.imageUri) {
                        avatar = resolveAvatarUrl(user.imageUri);
                    } else if (user.avatarUrl) {
                        avatar = resolveAvatarUrl(user.avatarUrl);
                    }
                }
            }
        } catch (err) {}

        // 3. Cosmos or Session fallbacks
        try {
            if (!avatar && Spicetify.CosmosAsync) {
                const cosmosData = await Spicetify.CosmosAsync.get("sp://user-profile/v1/user/me");
                if (cosmosData) {
                    if (!displayName && cosmosData.name) displayName = cosmosData.name;
                    if (cosmosData.picture) avatar = resolveAvatarUrl(cosmosData.picture);
                }
            }
        } catch (e) {}

        if (!username) {
            username = Spicetify.Platform?.Session?.canonicalUsername || "Current User";
        }
        if (!displayName) {
            displayName = username;
        }

        return {
            username,
            displayName,
            avatar
        };
    }

    function triggerNativeLogout() {
        try {
            if (Spicetify.Platform?.UserAPI?._session?.logout) {
                Spicetify.Platform.UserAPI._session.logout();
                return true;
            }
            if (Spicetify.Platform?.AuthorizationAPI?.logout) {
                Spicetify.Platform.AuthorizationAPI.logout();
                return true;
            }
            if (Spicetify.Platform?.Session?.logout) {
                Spicetify.Platform.Session.logout();
                return true;
            }
        } catch (e) {
            console.warn("[ProfileSwitcher] Platform logout error:", e);
        }

        try {
            const profileBtn = 
                document.querySelector('[data-testid="user-widget-link"]') ||
                document.querySelector('button[aria-label="User Profile"]') ||
                document.querySelector('.main-userWidget-box') ||
                document.querySelector('figure[data-testid="user-widget-avatar"]')?.closest('button');

            if (profileBtn) {
                /** @type {HTMLElement} */ (profileBtn).click();
                setTimeout(() => {
                    const items = Array.from(document.querySelectorAll('button[role="menuitem"], span'));
                    const logoutBtn = items.find(el => el.textContent && el.textContent.trim().toLowerCase() === 'log out');
                    if (logoutBtn) {
                        /** @type {HTMLElement} */ (logoutBtn).click();
                    }
                }, 200);
                return true;
            }
        } catch (e) {
            console.warn("[ProfileSwitcher] DOM logout error:", e);
        }

        return false;
    }

    async function openModal() {
        const currentUser = await getCurrentUserInfo();
        let profiles = await fetchProfiles();
        const serverOnline = await checkServerStatus();

        // Auto-update profile avatar if active profile has a newly discovered avatar
        if (currentUser.avatar) {
            let updated = false;
            profiles.forEach(p => {
                if ((p.username === currentUser.username || p.name === currentUser.username) && p.avatar !== currentUser.avatar) {
                    p.avatar = currentUser.avatar;
                    if (currentUser.displayName) p.displayName = currentUser.displayName;
                    updated = true;
                }
            });
            if (updated) {
                Spicetify.LocalStorage.set("spotify_saved_profiles", JSON.stringify(profiles));
                const matched = profiles.find(p => p.username === currentUser.username || p.name === currentUser.username);
                if (matched) {
                    const params = new URLSearchParams({
                        name: matched.name,
                        displayName: matched.displayName || matched.name,
                        username: matched.username || currentUser.username,
                        avatar: currentUser.avatar
                    });
                    fetch(`${SERVER_URL}/save?${params.toString()}`).catch(() => {});
                }
            }
        }

        const style = `
            /* Target parent Spicetify dialog and modal wrappers */
            div[role="dialog"]:has(.ps-modal-container),
            .GenericModal:has(.ps-modal-container),
            .main-trackCreditsModal-container:has(.ps-modal-container) {
                width: 620px !important;
                max-width: 620px !important;
                max-height: 85vh !important;
                border-radius: 16px !important;
                border: 1px solid rgba(255, 255, 255, 0.14) !important;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7) !important;
                overflow: hidden !important;
            }

            /* Remove scrollbars and arrows completely */
            div[role="dialog"]:has(.ps-modal-container),
            div[role="dialog"]:has(.ps-modal-container) *,
            .GenericModal:has(.ps-modal-container),
            .GenericModal:has(.ps-modal-container) * {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
            }

            div[role="dialog"]:has(.ps-modal-container)::-webkit-scrollbar,
            div[role="dialog"]:has(.ps-modal-container) *::-webkit-scrollbar,
            .GenericModal:has(.ps-modal-container)::-webkit-scrollbar,
            .GenericModal:has(.ps-modal-container) *::-webkit-scrollbar {
                display: none !important;
                width: 0px !important;
                height: 0px !important;
            }

            div[role="dialog"]:has(.ps-modal-container)::-webkit-scrollbar-button,
            div[role="dialog"]:has(.ps-modal-container) *::-webkit-scrollbar-button,
            .GenericModal:has(.ps-modal-container)::-webkit-scrollbar-button,
            .GenericModal:has(.ps-modal-container) *::-webkit-scrollbar-button {
                display: none !important;
                width: 0px !important;
                height: 0px !important;
            }

            div[role="dialog"]:has(.ps-modal-container) > div,
            .GenericModal:has(.ps-modal-container) > div {
                max-height: none !important;
                overflow: visible !important;
            }

            .ps-modal-container {
                display: flex;
                flex-direction: column;
                gap: 18px;
                color: #ffffff;
                font-family: var(--font-family, CircularSp, CircularSp-Arab, CircularSp-Hebr, CircularSp-Cyrl, CircularSp-Grek, CircularSp-Deva, var(--fallback-fonts, sans-serif));
                padding: 4px 0 10px 0;
                width: 570px;
                max-width: 100%;
                box-sizing: border-box;
            }

            .ps-section-label {
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                color: #a7a7a7;
                margin-bottom: 8px;
            }

            .ps-card {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 12px 18px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
            }
            .ps-card:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(255, 255, 255, 0.15);
            }

            .ps-card.active-card {
                background: rgba(29, 185, 84, 0.08);
                border: 1px solid rgba(29, 185, 84, 0.4);
            }
            .ps-card.active-card:hover {
                background: rgba(29, 185, 84, 0.12);
                border-color: rgba(29, 185, 84, 0.6);
            }

            .ps-user-info {
                display: flex;
                align-items: center;
                gap: 14px;
                min-width: 0;
                flex: 1;
            }

            .ps-avatar-wrap {
                position: relative;
                flex-shrink: 0;
            }

            .ps-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: #282828;
                display: flex;
                align-items: center;
                justify-content: center;
                object-fit: cover;
                font-size: 22px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .ps-avatar-indicator {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 13px;
                height: 13px;
                background-color: #1ed760;
                border: 2px solid #121212;
                border-radius: 50%;
            }

            .ps-details {
                display: flex;
                flex-direction: column;
                min-width: 0;
                gap: 3px;
            }

            .ps-name {
                font-size: 15px;
                font-weight: 700;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                letter-spacing: -0.2px;
            }

            .ps-sub {
                font-size: 12px;
                color: #a7a7a7;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .ps-badge {
                font-size: 10px;
                font-weight: 800;
                background: #1ed760;
                color: #000000;
                padding: 4px 9px;
                border-radius: 12px;
                letter-spacing: 0.8px;
                display: inline-flex;
                align-items: center;
                width: fit-content;
            }

            .ps-btn {
                background-color: #1ed760;
                color: #000000;
                border: none;
                border-radius: 500px;
                padding: 9px 22px;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                transition: transform 0.15s ease, background-color 0.2s ease, box-shadow 0.2s ease;
                letter-spacing: 0.2px;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .ps-btn:hover {
                transform: scale(1.04);
                background-color: #1fdf64;
                box-shadow: 0 4px 16px rgba(30, 215, 96, 0.3);
            }
            .ps-btn:active {
                transform: scale(0.98);
            }

            .ps-btn-sec {
                background-color: transparent;
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: #ffffff;
                border-radius: 500px;
                padding: 9px 20px;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                transition: transform 0.15s ease, border-color 0.2s ease, background 0.2s ease;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .ps-btn-sec:hover {
                border-color: #ffffff;
                background: rgba(255, 255, 255, 0.08);
                transform: scale(1.03);
            }
            .ps-btn-sec:active {
                transform: scale(0.98);
            }

            .ps-btn-icon {
                background: transparent;
                border: none;
                color: #a7a7a7;
                width: 34px;
                height: 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 50%;
                transition: background 0.2s, color 0.2s, transform 0.15s;
            }
            .ps-btn-icon:hover {
                background: rgba(255, 80, 80, 0.15);
                color: #ff5e5e;
                transform: scale(1.1);
            }

            .ps-actions {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 12px;
                margin-top: 6px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                padding-top: 16px;
            }

            .ps-list-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .ps-server-warning {
                background: rgba(255, 170, 0, 0.12);
                border: 1px solid rgba(255, 170, 0, 0.4);
                color: #ffcc66;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
        `;

        const content = document.createElement("div");
        content.classList.add("ps-modal-container");

        const styleEl = document.createElement("style");
        styleEl.innerHTML = style;
        content.appendChild(styleEl);

        if (!serverOnline) {
            const warnEl = document.createElement("div");
            warnEl.classList.add("ps-server-warning");
            warnEl.innerHTML = `
                <span>⚠️ Local helper service is offline.</span>
                <span style="font-size: 11px; opacity: 0.85;">Reconnecting...</span>
            `;
            content.appendChild(warnEl);
        }

        // Active Session
        const currentSection = document.createElement("div");
        currentSection.innerHTML = `
            <div class="ps-section-label">Currently Active Session</div>
            <div class="ps-card active-card">
                <div class="ps-user-info">
                    <div class="ps-avatar-wrap">
                        ${currentUser.avatar 
                            ? `<img class="ps-avatar" src="${currentUser.avatar}" alt="Avatar"/>` 
                            : `<div class="ps-avatar">👤</div>`}
                        <div class="ps-avatar-indicator"></div>
                    </div>
                    <div class="ps-details">
                        <span class="ps-name">${currentUser.displayName}</span>
                        <span class="ps-sub">${currentUser.username}</span>
                    </div>
                </div>
                <div>
                    <span class="ps-badge">ACTIVE</span>
                </div>
            </div>
        `;
        content.appendChild(currentSection);

        // Saved Profiles Section
        const savedSection = document.createElement("div");
        savedSection.innerHTML = `<div class="ps-section-label">Saved Profiles</div>`;

        const listContainer = document.createElement("div");
        listContainer.classList.add("ps-list-container");

        if (profiles.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.style.fontSize = "13px";
            emptyEl.style.color = "#888888";
            emptyEl.style.fontStyle = "italic";
            emptyEl.style.padding = "14px 10px";
            emptyEl.style.textAlign = "center";
            emptyEl.style.background = "rgba(255, 255, 255, 0.02)";
            emptyEl.style.borderRadius = "8px";
            emptyEl.innerText = "No profiles saved yet. Click 'Save Current Account' below to store this session.";
            listContainer.appendChild(emptyEl);
        } else {
            profiles.forEach(p => {
                const isCurrent = (p.username === currentUser.username || p.name === currentUser.username);
                // If it's active user and active user has an avatar, use it directly
                const displayAvatar = (isCurrent && currentUser.avatar) ? currentUser.avatar : p.avatar;

                const item = document.createElement("div");
                item.classList.add("ps-card");
                if (isCurrent) item.classList.add("active-card");

                item.innerHTML = `
                    <div class="ps-user-info">
                        <div class="ps-avatar-wrap">
                            ${displayAvatar 
                                ? `<img class="ps-avatar" src="${displayAvatar}" alt="Avatar"/>` 
                                : `<div class="ps-avatar">👤</div>`}
                            ${isCurrent ? `<div class="ps-avatar-indicator"></div>` : ''}
                        </div>
                        <div class="ps-details">
                            <span class="ps-name">${p.displayName || p.name}</span>
                            <span class="ps-sub">${p.username || p.name}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${!isCurrent 
                            ? `<button class="ps-btn switch-btn">Switch</button>` 
                            : `<span class="ps-badge">ACTIVE</span>`}
                        <button class="ps-btn-icon del-btn" title="Remove Profile">
                            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </button>
                    </div>
                `;

                const switchBtn = item.querySelector(".switch-btn");
                if (switchBtn) {
                    switchBtn.addEventListener("click", async () => {
                        Spicetify.PopupModal.hide();
                        Spicetify.showNotification(`Switching to ${p.displayName || p.name}... Spotify will restart.`);
                        try {
                            await fetch(`${SERVER_URL}/switch?name=${encodeURIComponent(p.name)}`);
                        } catch (e) {
                            alert("Could not connect to the profile helper. Please make sure the background helper is running.");
                        }
                    });
                }

                const delBtn = item.querySelector(".del-btn");
                delBtn.addEventListener("click", async () => {
                    if (confirm(`Remove saved profile "${p.displayName || p.name}"?`)) {
                        try {
                            await fetch(`${SERVER_URL}/delete?name=${encodeURIComponent(p.name)}`);
                        } catch (e) {}
                        const local = profiles.filter(x => x.name !== p.name);
                        Spicetify.LocalStorage.set("spotify_saved_profiles", JSON.stringify(local));
                        Spicetify.PopupModal.hide();
                        openModal();
                    }
                });

                listContainer.appendChild(item);
            });
        }

        savedSection.appendChild(listContainer);
        content.appendChild(savedSection);

        // Action Buttons Row
        const actions = document.createElement("div");
        actions.classList.add("ps-actions");

        const addNewBtn = document.createElement("button");
        addNewBtn.classList.add("ps-btn-sec");
        addNewBtn.innerHTML = `
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
            </svg>
            Add Another Account
        `;
        addNewBtn.addEventListener("click", async () => {
            if (confirm("Spotify will take you to the login screen so you can sign in with your other account. Once signed in, open the Profile Switcher to save it. Continue?")) {
                Spicetify.PopupModal.hide();
                Spicetify.showNotification("Signing out to login screen...");

                try {
                    await fetch(`${SERVER_URL}/new`);
                } catch (e) {}

                triggerNativeLogout();
            }
        });

        const saveCurrentBtn = document.createElement("button");
        saveCurrentBtn.classList.add("ps-btn");
        saveCurrentBtn.innerHTML = `
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.414a1 1 0 0 0-.293-.707l-2.414-2.414A1 1 0 0 0 11.586 1H2zm1 2h8v2H3V3zm9 11H3V8h9v6z"/>
            </svg>
            Save Current Account
        `;
        saveCurrentBtn.addEventListener("click", async () => {
            const defaultName = currentUser.displayName || currentUser.username || "Account";
            const customName = prompt("Enter a label for this account profile:", defaultName);
            if (!customName) return;

            const safeId = customName.replace(/[^a-zA-Z0-9_\-]/g, "_");

            const existing = profiles.filter(x => x.name !== safeId);
            existing.push({
                name: safeId,
                displayName: customName,
                username: currentUser.username,
                avatar: currentUser.avatar
            });
            Spicetify.LocalStorage.set("spotify_saved_profiles", JSON.stringify(existing));

            Spicetify.PopupModal.hide();
            Spicetify.showNotification(`Saving "${customName}"... Spotify will restart.`);

            const params = new URLSearchParams({
                name: safeId,
                displayName: customName,
                username: currentUser.username,
                avatar: currentUser.avatar || ""
            });

            try {
                await fetch(`${SERVER_URL}/save?${params.toString()}`);
            } catch (err) {
                console.error("[ProfileSwitcher] Error calling save:", err);
            }
        });

        actions.appendChild(addNewBtn);
        actions.appendChild(saveCurrentBtn);
        content.appendChild(actions);

        Spicetify.PopupModal.display({
            title: "Spotify Profile Switcher",
            content: content
        });

        // Widen modal immediately in the DOM & remove scrollbar
        setTimeout(() => {
            try {
                let el = content;
                while (el && el !== document.body) {
                    if (el.getAttribute("role") === "dialog" || el.classList.contains("GenericModal")) {
                        el.style.setProperty("width", "620px", "important");
                        el.style.setProperty("max-width", "620px", "important");
                        el.style.setProperty("max-height", "none", "important");
                        el.style.setProperty("overflow", "hidden", "important");
                        el.style.setProperty("border-radius", "16px", "important");
                        el.style.setProperty("border", "1px solid rgba(255, 255, 255, 0.14)", "important");
                        el.style.setProperty("box-shadow", "0 16px 48px rgba(0, 0, 0, 0.7)", "important");

                        el.querySelectorAll("*").forEach(node => {
                            if (node instanceof HTMLElement) {
                                node.style.scrollbarWidth = "none";
                            }
                        });

                        const childBox = el.firstElementChild;
                        if (childBox && childBox instanceof HTMLElement) {
                            childBox.style.setProperty("overflow", "hidden", "important");
                            childBox.style.setProperty("max-height", "none", "important");
                        }
                        break;
                    }
                    el = el.parentElement;
                }
            } catch (err) {}
        }, 10);
    }

    // Register TopBar Button
    const switcherIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z"/>
        <path d="M18 10l3 3-1.4 1.4-1.6-1.6V18h-2v-5.2l-1.6 1.6L15 13l3-3z"/>
    </svg>`;

    new Spicetify.Topbar.Button(
        "Profile Switcher",
        switcherIcon,
        () => {
            openModal();
        }
    );
})();
