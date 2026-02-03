const Store = require('electron-store');
const path = require('path');
const os = require('os');

class ConfigManager {
    constructor() {
        this.store = new Store({
            name: 'config',
            cwd: path.join(os.homedir(), '.konus'),
            defaults: {
                autostart: false,
                hotkey: 'altgr+l',
                language: 'auto',
                typing_method: 'clipboard',
                typing_delay: 10,
                openai_api_key: '',
                log_level: 'INFO'
            }
        });

        console.log('Configuration loaded from:', this.store.path);
    }

    get(key, defaultValue = null) {
        const value = this.store.get(key);
        return value !== undefined ? value : defaultValue;
    }

    set(key, value) {
        this.store.set(key, value);
    }

    update(updates) {
        for (const [key, value] of Object.entries(updates)) {
            this.store.set(key, value);
        }
    }

    getAll() {
        return this.store.store;
    }

    resetToDefaults() {
        this.store.clear();
    }

    get path() {
        return this.store.path;
    }
}

module.exports = ConfigManager;
