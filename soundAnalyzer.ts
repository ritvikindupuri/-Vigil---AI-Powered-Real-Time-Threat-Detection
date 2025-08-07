import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";
import type { SoundAnalysisResult } from './types';

export class SoundAnalyzer {
    private audioClassifier: AudioClassifier | undefined;
    private audioCtx: AudioContext | undefined;
    private stream: MediaStream | undefined;
    private source: MediaStreamAudioSourceNode | undefined;
    private scriptNode: ScriptProcessorNode | undefined;

    private constructor(private onResult: (result: SoundAnalysisResult) => void) {}

    public static async create(onResult: (result: SoundAnalysisResult) => void): Promise<SoundAnalyzer> {
        const analyzer = new SoundAnalyzer(onResult);
        await analyzer.initialize();
        return analyzer;
    }

    private async initialize(): Promise<void> {
        try {
            const audioTasks = await FilesetResolver.forAudioTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm"
            );
            this.audioClassifier = await AudioClassifier.createFromOptions(audioTasks, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite",
                },
                maxResults: 5,
            });
        } catch (e) {
            console.error("Failed to initialize SoundAnalyzer", e);
            throw new Error("Could not initialize sound analyzer. " + (e instanceof Error ? e.message : String(e)));
        }
    }

    public async start(): Promise<void> {
        if (!this.audioClassifier) {
            throw new Error("SoundAnalyzer is not initialized.");
        }
        if (this.audioCtx && this.audioCtx.state === "running") {
            console.warn("Sound analysis is already running.");
            return;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (!this.audioCtx) {
                // The model expects a sample rate of 16000
                this.audioCtx = new AudioContext({ sampleRate: 16000 });
            }

            await this.audioCtx.resume();

            this.source = this.audioCtx.createMediaStreamSource(this.stream);
            // The model expects audio chunks of 16384 samples.
            this.scriptNode = this.audioCtx.createScriptProcessor(16384, 1, 1);

            this.scriptNode.onaudioprocess = (audioProcessingEvent) => {
                if (!this.audioClassifier) return;

                const inputBuffer = audioProcessingEvent.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);

                const results = this.audioClassifier.classify(inputData);

                if (results.length > 0 && results[0].classifications.length > 0) {
                    const soundEvents: SoundAnalysisResult = results[0].classifications[0].categories.map(category => ({
                        categoryName: category.categoryName,
                        score: category.score,
                    }));
                    this.onResult(soundEvents);
                }
            };

            this.source.connect(this.scriptNode);
            this.scriptNode.connect(this.audioCtx.destination);

        } catch (err) {
            console.error("Error starting sound analysis:", err);
            throw new Error("Failed to start sound analysis. Please check microphone permissions.");
        }
    }

    public async stop(): Promise<void> {
        if (this.audioCtx && this.audioCtx.state === "running") {
            await this.audioCtx.suspend();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if(this.source) {
            this.source.disconnect();
        }
        if(this.scriptNode) {
            this.scriptNode.disconnect();
        }
        this.stream = undefined;
        this.source = undefined;
        this.scriptNode = undefined;
    }
}
