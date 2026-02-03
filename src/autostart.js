const AutoLaunch = require('auto-launch');
const { app } = require('electron');

class AutostartManager {
    constructor() {
        this.appName = 'Konuş';
        this.autoLauncher = new AutoLaunch({
            name: this.appName,
            path: app.getPath('exe')
        });
    }

    async enable() {
        try {
            const isEnabled = await this.autoLauncher.isEnabled();
            if (!isEnabled) {
                await this.autoLauncher.enable();
                console.log('Autostart enabled');
            }
            return true;
        } catch (error) {
            console.error('Failed to enable autostart:', error);
            return false;
        }
    }

    async disable() {
        try {
            const isEnabled = await this.autoLauncher.isEnabled();
            if (isEnabled) {
                await this.autoLauncher.disable();
                console.log('Autostart disabled');
            }
            return true;
        } catch (error) {
            console.error('Failed to disable autostart:', error);
            return false;
        }
    }

    async isEnabled() {
        try {
            return await this.autoLauncher.isEnabled();
        } catch (error) {
            console.error('Failed to check autostart status:', error);
            return false;
        }
    }
}

module.exports = AutostartManager;
