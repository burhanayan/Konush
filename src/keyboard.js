const { clipboard } = require('electron');
const robot = require('@jitsi/robotjs');

class KeyboardSimulator {
    constructor(options = {}) {
        this.typingDelay = options.typingDelay || 10;
    }

    async typeText(text, method = 'clipboard') {
        if (!text) return;

        try {
            // Small delay to ensure focus is on target application
            await this.delay(200);

            if (method === 'clipboard') {
                await this.typeViaClipboard(text);
            } else {
                await this.typeViaKeystrokes(text);
            }

            console.log(`Successfully typed ${text.length} characters`);
        } catch (error) {
            console.error('Error typing text:', error);
        }
    }

    async typeViaClipboard(text) {
        // Save current clipboard content
        let originalClipboard = null;
        try {
            originalClipboard = clipboard.readText();
        } catch (e) {
            // Ignore
        }

        try {
            // Copy text to clipboard
            clipboard.writeText(text);

            // Small delay before paste
            await this.delay(50);

            // Paste using Ctrl+V
            robot.keyTap('v', 'control');

            // Small delay before restoring clipboard
            await this.delay(100);
        } finally {
            // Restore original clipboard content
            if (originalClipboard !== null) {
                try {
                    await this.delay(100);
                    clipboard.writeText(originalClipboard);
                } catch (e) {
                    // Ignore
                }
            }
        }
    }

    async typeViaKeystrokes(text) {
        // Type character by character (slower but more compatible)
        for (const char of text) {
            robot.typeString(char);
            if (this.typingDelay > 0) {
                await this.delay(this.typingDelay);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setTypingDelay(delay) {
        this.typingDelay = Math.max(0, delay);
        console.log(`Typing delay set to ${this.typingDelay}ms`);
    }
}

module.exports = KeyboardSimulator;
