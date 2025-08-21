import * as tf from '@tensorflow/tfjs';
import { Tensor, GraphModel } from '@tensorflow/tfjs';

// --- Constants ---
const YAMNET_MODEL_URL = 'https://tfhub.dev/google/yamnet/1';
const MIN_SCORE_THRESHOLD = 0.3; // Minimum confidence score to consider a detection.
const REQUIRED_SAMPLE_RATE = 16000;
const MODEL_INPUT_LENGTH_SECONDS = 0.975;

// A subset of YAMNet classes we are interested in for security purposes.
// The full list of 521 classes is available with the model.
const TARGET_SOUNDS = new Set([
    'Gunshot, gunfire',
    'Explosion',
    'Screaming',
    'Shout',
    'Glass', // Catches "Smash, crash, breaking glass"
    'Speech', // To distinguish from other sounds
    'Silence'
]);

export interface AudioEvent {
    timestamp: number;
    className: string;
    score: number;
}

type AudioEventCallback = (event: AudioEvent) => void;

class AudioService {
    private model: GraphModel | null = null;
    private audioContext: AudioContext | null = null;
    private stream: MediaStream | null = null;
    private classMap: { [index: number]: string } = {};
    private isRunning = false;
    private onAudioEvent: AudioEventCallback = () => {};

    // --- Public API ---

    public async initialize(callback: AudioEventCallback): Promise<void> {
        if (this.model) return;
        this.onAudioEvent = callback;

        try {
            console.log('Loading YAMNet model...');
            this.model = await tf.loadGraphModel(YAMNET_MODEL_URL, { fromTFHub: true });
            console.log('YAMNet model loaded.');

            console.log('Fetching class map...');
            // The class map is an asset of the TF Hub model.
            const classMapUrl = this.model.artifacts['class_map_path'];
            const response = await fetch(classMapUrl);
            const csvText = await response.text();
            this.parseClassMap(csvText);
            console.log('Class map loaded.');

        } catch (error) {
            console.error('Failed to initialize AudioService:', error);
            throw new Error('Could not load the audio analysis model.');
        }
    }

    public async start(): Promise<void> {
        if (!this.model || this.isRunning) return;

        try {
            this.audioContext = new AudioContext({ sampleRate: REQUIRED_SAMPLE_RATE });
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.isRunning = true;
            this.runAnalysis();
            console.log('Audio analysis started.');
        } catch (error) {
            console.error('Failed to start audio monitoring:', error);
            throw new Error('Could not access microphone. Please ensure permissions are granted.');
        }
    }

    public stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.stream?.getTracks().forEach(track => track.stop());
        this.audioContext?.close();
        this.stream = null;
        this.audioContext = null;
        console.log('Audio analysis stopped.');
    }

    // --- Internal Methods ---

    private parseClassMap(csvText: string): void {
        const lines = csvText.split('\n').slice(1); // skip header
        lines.forEach(line => {
            const [index, _, displayName] = line.split(',');
            if (index && displayName) {
                this.classMap[parseInt(index)] = displayName.replace(/"/g, '');
            }
        });
    }

    private async runAnalysis(): Promise<void> {
        if (!this.isRunning || !this.model || !this.audioContext || !this.stream) return;

        const source = this.audioContext.createMediaStreamSource(this.stream);
        const processor = this.audioContext.createScriptProcessor(16384, 1, 1); // Buffer size, input channels, output channels

        source.connect(processor);
        processor.connect(this.audioContext.destination);

        processor.onaudioprocess = async (e: AudioProcessingEvent) => {
            if (!this.isRunning) {
                source.disconnect();
                processor.disconnect();
                return;
            }

            const inputData = e.inputBuffer.getChannelData(0);
            const waveform = tf.tensor(inputData);

            try {
                const [scores, embeddings, spectrogram] = this.model!.execute(waveform) as Tensor[];
                const scoresData = await scores.data();

                this.processScores(scoresData as Float32Array);

                tf.dispose([scores, embeddings, spectrogram, waveform]);

            } catch (error) {
                console.error('Error during audio analysis:', error);
            }
        };

        // This recursive call is just to keep the "runAnalysis" alive in concept.
        // The actual loop is handled by `onaudioprocess`.
        // We can add a check here to stop if needed.
        if (this.isRunning) {
            setTimeout(() => this.runAnalysis(), 100);
        }
    }

    private processScores(scoresData: Float32Array): void {
        const timestamp = Date.now();

        scoresData.forEach((score, i) => {
            if (score > MIN_SCORE_THRESHOLD) {
                const className = this.classMap[i];
                if (className && TARGET_SOUNDS.has(className)) {
                    this.onAudioEvent({
                        timestamp,
                        className,
                        score
                    });
                }
            }
        });
    }
}

// Export a singleton instance of the service
export const audioService = new AudioService();
