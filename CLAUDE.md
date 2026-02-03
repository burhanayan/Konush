# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Konuş is an Electron-based voice-to-text application that runs in the Windows system tray. It captures audio via a configurable hotkey (hold to record), transcribes using OpenAI Whisper API, and pastes the result into the active application.

## Commands

```bash
npm install      # Install dependencies
npm start        # Run the application
npm run build    # Build distributable (electron-builder)
```

## Architecture

```
main.js                    # Electron main process, app lifecycle, IPC handlers
preload.js                 # Context bridge for renderer processes
src/
  tray.js                  # System tray management (icons: grey/green/red states)
  config.js                # electron-store based config (~/.konus/config.json)
  transcriber.js           # OpenAI Whisper API integration
  keyboard.js              # Clipboard paste via robotjs (Ctrl+V)
  autostart.js             # Windows autostart via auto-launch
renderer/
  recorder.html            # Hidden window with Web Audio API for recording
  settings.html            # Settings UI (API key, language, hotkey)
assets/icons/              # Tray icons (icon_grey.png, icon_green.png, icon_red.png)
```

## Key Implementation Details

- **Hotkey Detection**: Uses `uiohook-napi` for global key press/release detection (not Electron's globalShortcut) to support hold-to-record behavior
- **Audio Recording**: Web Audio API in a hidden BrowserWindow (renderer/recorder.html), outputs webm/opus format
- **IPC Flow**: Main process sends `start-recording`/`stop-recording`/`cancel-recording` to recorder window; recorder sends `recording-data` back
- **Minimum Recording**: 500ms minimum duration, recordings < 1KB are skipped
- **Config Storage**: Uses electron-store, config stored at `%USERPROFILE%\.konus\config.json`

## Configuration Keys

- `openai_api_key`: OpenAI API key (also checks `OPENAI_API_KEY` env var)
- `language`: Transcription language (auto, tr, en, de)
- `hotkey`: `{ modifier: 'AltRight', key: 'L' }` - uses UiohookKey enum names
- `autostart`: Boolean for Windows startup

## Notes

- Hotkey changes require app restart
- The app uses single instance lock to prevent multiple instances
