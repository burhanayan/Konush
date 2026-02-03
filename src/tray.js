const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

class TrayManager {
    constructor(appInstance) {
        this.app = appInstance;
        this.tray = null;
        this.iconsPath = this.getIconsPath();
    }

    getIconsPath() {
        // Check if running from packaged app
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'icons');
        }
        return path.join(__dirname, '..', 'assets', 'icons');
    }

    getIconPath() {
        let iconFile;
        if (this.app.isRecording) {
            iconFile = 'icon_red.png';
        } else if (this.app.isListening) {
            iconFile = 'icon_green.png';
        } else {
            iconFile = 'icon_grey.png';
        }
        return path.join(this.iconsPath, iconFile);
    }

    create() {
        const iconPath = this.getIconPath();
        const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });

        this.tray = new Tray(icon);
        this.tray.setToolTip('Konuş - Voice to Text');
        this.updateContextMenu();
    }

    updateIcon() {
        if (!this.tray) return;

        const iconPath = this.getIconPath();
        const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
        this.tray.setImage(icon);
        this.updateContextMenu();
    }

    updateContextMenu() {
        if (!this.tray) return;

        const currentLanguage = this.app.config.get('language', 'auto');
        const isAutostart = this.app.config.get('autostart', false);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: this.app.isListening ? 'Stop Listening' : 'Start Listening',
                click: () => this.app.toggleListening()
            },
            { type: 'separator' },
            {
                label: 'Language',
                submenu: [
                    {
                        label: 'Auto',
                        type: 'radio',
                        checked: currentLanguage === 'auto',
                        click: () => this.app.setLanguage('auto')
                    },
                    {
                        label: 'Turkish',
                        type: 'radio',
                        checked: currentLanguage === 'tr',
                        click: () => this.app.setLanguage('tr')
                    },
                    {
                        label: 'English',
                        type: 'radio',
                        checked: currentLanguage === 'en',
                        click: () => this.app.setLanguage('en')
                    },
                    {
                        label: 'German',
                        type: 'radio',
                        checked: currentLanguage === 'de',
                        click: () => this.app.setLanguage('de')
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Enable Autostart',
                type: 'checkbox',
                checked: isAutostart,
                click: () => this.app.toggleAutostart()
            },
            { type: 'separator' },
            {
                label: 'Settings',
                click: () => this.app.showSettings()
            },
            {
                label: 'Exit',
                click: () => this.app.quit()
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

module.exports = TrayManager;
