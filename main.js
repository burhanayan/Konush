const { app, globalShortcut, ipcMain, BrowserWindow, screen } = require('electron');
const path = require('path');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const TrayManager = require('./src/tray');
const Transcriber = require('./src/transcriber');
const KeyboardSimulator = require('./src/keyboard');
const ConfigManager = require('./src/config');
const AutostartManager = require('./src/autostart');

class KonusApp {
    constructor() {
        this.tray = null;
        this.config = null;
        this.transcriber = null;
        this.keyboard = null;
        this.autostart = null;
        this.recorderWindow = null;
        this.settingsWindow = null;
        this.overlayWindow = null;

        this.isListening = true;
        this.isRecording = false;
        this.modifierPressed = false;
        this.hotkeyPressed = false;
        this.recordingStartTime = null;
    }

    async init() {
        // Initialize configuration
        this.config = new ConfigManager();

        // Initialize components
        this.transcriber = new Transcriber(this.config);
        this.keyboard = new KeyboardSimulator();
        this.autostart = new AutostartManager();

        // Create hidden recorder window for Web Audio API
        await this.createRecorderWindow();

        // Create system tray
        this.tray = new TrayManager(this);
        this.tray.create();

        // Setup global hotkey with press/release detection
        this.setupHotkey();

        // Apply autostart setting
        if (this.config.get('autostart')) {
            this.autostart.enable();
        }

        // Setup IPC handlers
        this.setupIPC();

        console.log('Konuş application started');
    }

    async createRecorderWindow() {
        this.recorderWindow = new BrowserWindow({
            width: 1,
            height: 1,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        await this.recorderWindow.loadFile(path.join(__dirname, 'renderer', 'recorder.html'));
    }

    showOverlay() {
        if (this.overlayWindow) {
            this.overlayWindow.show();
            return;
        }

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const overlayWidth = 240;
        const overlayHeight = 120;

        this.overlayWindow = new BrowserWindow({
            width: overlayWidth,
            height: overlayHeight,
            x: Math.round((width - overlayWidth) / 2),
            y: Math.round((height - overlayHeight) / 2),
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            focusable: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        this.overlayWindow.setIgnoreMouseEvents(true);
        this.overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

        this.overlayWindow.on('closed', () => {
            this.overlayWindow = null;
        });
    }

    hideOverlay() {
        if (this.overlayWindow) {
            this.overlayWindow.destroy();
            this.overlayWindow = null;
        }
    }

    setupHotkey() {
        // Get configured hotkey
        const hotkeyConfig = this.config.get('hotkey', { modifier: 'AltRight', key: 'L' });
        const modifierKey = UiohookKey[hotkeyConfig.modifier];
        const mainKey = UiohookKey[hotkeyConfig.key];

        console.log('Hotkey config:', hotkeyConfig);
        console.log('Modifier key code:', modifierKey, '(from:', hotkeyConfig.modifier, ')');
        console.log('Main key code:', mainKey, '(from:', hotkeyConfig.key, ')');

        if (!modifierKey || !mainKey) {
            console.error('Invalid hotkey configuration!');
            return;
        }

        // Use uiohook for press/release detection
        uIOhook.on('keydown', (e) => {
            // Debug: log all key presses
            // console.log('Key down:', e.keycode);

            // Modifier key pressed
            if (e.keycode === modifierKey) {
                this.modifierPressed = true;
                console.log('Modifier pressed');
            }

            // Main key pressed while modifier is held
            if (e.keycode === mainKey && this.modifierPressed) {
                if (this.isListening && !this.isRecording) {
                    this.hotkeyPressed = true;
                    this.startRecording();
                }
            }
        });

        uIOhook.on('keyup', (e) => {
            // Modifier key released
            if (e.keycode === modifierKey) {
                this.modifierPressed = false;
                if (this.isRecording && this.hotkeyPressed) {
                    this.hotkeyPressed = false;
                    this.stopRecording();
                }
            }

            // Main key released while recording
            if (e.keycode === mainKey && this.isRecording && this.hotkeyPressed) {
                this.hotkeyPressed = false;
                this.stopRecording();
            }
        });

        uIOhook.start();
        const hotkeyName = `${hotkeyConfig.modifier}+${hotkeyConfig.key}`;
        console.log(`Hotkey listener started (${hotkeyName} hold to record)`);
    }

    setupIPC() {
        ipcMain.handle('get-config', () => {
            return this.config.getAll();
        });

        ipcMain.handle('set-config', (event, key, value) => {
            this.config.set(key, value);
        });

        ipcMain.on('window-minimize', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) win.minimize();
        });

        ipcMain.on('window-close', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) win.close();
        });

        ipcMain.on('recording-data', async (event, audioData) => {
            if (audioData && audioData.length > 0) {
                console.log('Received audio data, transcribing...');
                const buffer = Buffer.from(audioData);
                const text = await this.transcriber.transcribe(buffer);

                if (text) {
                    console.log('Transcribed:', text);
                    await this.keyboard.typeText(text);
                } else {
                    console.log('No text transcribed');
                }
            }
        });
    }

    startRecording() {
        if (this.isRecording || !this.recorderWindow) return;

        console.log('Starting recording...');
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.tray.updateIcon();
        this.showOverlay();

        this.recorderWindow.webContents.send('start-recording');
    }

    stopRecording() {
        if (!this.isRecording || !this.recorderWindow) return;

        const recordingDuration = Date.now() - this.recordingStartTime;
        const MIN_RECORDING_MS = 500; // Minimum 500ms

        console.log(`Stopping recording... (duration: ${recordingDuration}ms)`);
        this.isRecording = false;
        this.tray.updateIcon();
        this.hideOverlay();

        if (recordingDuration < MIN_RECORDING_MS) {
            console.log('Recording too short, discarding');
            this.recorderWindow.webContents.send('cancel-recording');
            return;
        }

        this.recorderWindow.webContents.send('stop-recording');
    }

    toggleListening() {
        this.isListening = !this.isListening;
        console.log('Listening:', this.isListening);
        this.tray.updateIcon();
    }

    setLanguage(language) {
        this.config.set('language', language);
        console.log('Language set to:', language);
    }

    toggleAutostart() {
        const current = this.config.get('autostart', false);
        const newValue = !current;
        this.config.set('autostart', newValue);

        if (newValue) {
            this.autostart.enable();
        } else {
            this.autostart.disable();
        }

        console.log('Autostart:', newValue);
    }

    showSettings() {
        if (this.settingsWindow) {
            this.settingsWindow.focus();
            return;
        }

        this.settingsWindow = new BrowserWindow({
            width: 500,
            height: 420,
            resizable: false,
            frame: false,
            backgroundColor: '#1e1e1e',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        this.settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

        this.settingsWindow.on('closed', () => {
            this.settingsWindow = null;
        });
    }

    quit() {
        console.log('Quitting application...');
        uIOhook.stop();
        globalShortcut.unregisterAll();
        if (this.tray) {
            this.tray.destroy();
        }
        if (this.recorderWindow) {
            this.recorderWindow.destroy();
        }
        if (this.overlayWindow) {
            this.overlayWindow.destroy();
        }
        app.quit();
    }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    const konusApp = new KonusApp();

    app.on('ready', () => {
        konusApp.init();
    });

    app.on('window-all-closed', (e) => {
        // Prevent app from quitting when all windows are closed
        e.preventDefault();
    });

    app.on('will-quit', () => {
        uIOhook.stop();
        globalShortcut.unregisterAll();
    });

    app.on('second-instance', () => {
        console.log('Second instance attempted, focusing existing instance');
    });
}
