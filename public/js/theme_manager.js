/**
 * MathSolver - ThemeManager Module
 * Copyright (c) 2026 ICeCreamChat
 * Licensed under the MIT License.
 *
 * Handles theme switching (day/night mode) and mobile status bar.
 */
const ThemeManager = {
    /**
     * Checks Beijing time and auto-switches theme (unless manually overridden).
     */
    checkBeijingTime() {
        if (StateManager.get('isManualTheme')) return;

        const { DAY_START_HOUR, DAY_END_HOUR } = window.CONSTANTS;
        const date = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
        const hour = date.getHours();

        const wasLight = document.body.classList.contains('light-mode');

        if (hour >= DAY_START_HOUR && hour < DAY_END_HOUR) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }

        const isLight = document.body.classList.contains('light-mode');
        if (wasLight !== isLight || !window.hasInitializedTheme) {
            this.updateMobileStatusBar();
            window.hasInitializedTheme = true;
        }
    },

    /**
     * Toggles theme manually and locks auto-switching.
     */
    toggleTheme() {
        StateManager.set('isManualTheme', true);
        document.body.classList.toggle('light-mode');

        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown) dropdown.classList.remove('show');

        this.updateMobileStatusBar();
    },

    /**
     * Syncs mobile status bar color with current theme.
     */
    updateMobileStatusBar() {
        const isLight = document.body.classList.contains('light-mode');
        const themeColor = isLight ? '#f0f4f8' : '#050b14';

        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = "theme-color";
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = themeColor;

        let metaStatusStyle = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (metaStatusStyle) {
            metaStatusStyle.content = isLight ? "default" : "black-translucent";
        }
    },

    /**
     * Initializes theme system with time check and interval.
     */
    init() {
        this.checkBeijingTime();
        setInterval(() => this.checkBeijingTime(), 60000);
        this.updateMobileStatusBar();
    }
};

window.ThemeManager = ThemeManager;
