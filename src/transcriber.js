const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

class Transcriber {
    constructor(configManager) {
        this.config = configManager;
        this.client = null;
        this.currentRequest = null;
        this.initializeClient();
    }

    initializeClient() {
        const apiKey = this.config.get('openai_api_key') || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            console.warn('OpenAI API key not found in config or environment');
            return;
        }

        try {
            // Custom agent to avoid HTTP/2 connection issues
            const agent = new https.Agent({
                keepAlive: false,
                rejectUnauthorized: true
            });

            this.client = new OpenAI({
                apiKey,
                timeout: 60000,
                maxRetries: 3,
                httpAgent: agent
            });
            console.log('OpenAI client initialized');
        } catch (error) {
            console.error('Failed to initialize OpenAI client:', error);
        }
    }

    cancelPendingRequest() {
        if (this.currentRequest) {
            console.log('Cancelling pending transcription request');
            this.currentRequest = null;
        }
    }

    async transcribe(audioBuffer) {
        // Cancel any pending request
        this.cancelPendingRequest();

        if (!this.client) {
            this.initializeClient();
            if (!this.client) {
                console.error('OpenAI client not initialized. Please set your API key.');
                return null;
            }
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            console.warn('No audio data to transcribe');
            return null;
        }

        // Check minimum size (very short recordings < 1KB are likely too short)
        const MIN_AUDIO_SIZE = 1000;
        if (audioBuffer.length < MIN_AUDIO_SIZE) {
            console.warn(`Audio too short (${audioBuffer.length} bytes), skipping transcription`);
            return null;
        }

        let tempPath = null;

        try {
            // Write buffer to temp file (webm format from Web Audio API)
            tempPath = path.join(os.tmpdir(), `konus_${Date.now()}.webm`);
            fs.writeFileSync(tempPath, audioBuffer);

            const language = this.config.get('language', 'auto');

            const params = {
                model: 'whisper-1',
                file: fs.createReadStream(tempPath),
                response_format: 'text'
            };

            if (language !== 'auto') {
                params.language = language;
                console.log(`Transcribing with language: ${language}`);
            } else {
                console.log('Transcribing with auto language detection');
            }

            console.log(`Audio size: ${audioBuffer.length} bytes`);

            // Track current request
            this.currentRequest = this.client.audio.transcriptions.create(params);
            const response = await this.currentRequest;
            this.currentRequest = null;

            const text = typeof response === 'string' ? response.trim() : response;

            if (text) {
                console.log(`Transcription successful: ${text.substring(0, 50)}...`);
            }

            return text;
        } catch (error) {
            this.currentRequest = null;

            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                console.error('Connection error, will retry on next recording');
            } else {
                console.error('Transcription failed:', error.message || error);
            }
            return null;
        } finally {
            // Clean up temp file
            if (tempPath) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    }

    updateApiKey(apiKey) {
        this.config.set('openai_api_key', apiKey);
        this.initializeClient();
    }
}

module.exports = Transcriber;
