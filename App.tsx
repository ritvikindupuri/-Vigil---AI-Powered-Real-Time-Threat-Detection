import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeImageContent, analyzeVerbalContent } from './geminiService';
import { SoundAnalyzer } from './soundAnalyzer';
import type { Alert, ImageAnalysisResult, Session, SoundAnalysisResult } from './types';
import LiveMonitoringView, { LiveMonitoringViewRef } from './LiveMonitoringView';
import EventLog from './EventLog';
import Header from './components/Header';
import HistoryModal from './components/HistoryModal';

// Web Speech API interface
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState({ image: false, verbal: false });
  const [latestTranscript, setLatestTranscript] = useState('');
  const [latestAnalysis, setLatestAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const speechRecognition = useRef<any>(null);
  const monitoringViewRef = useRef<LiveMonitoringViewRef>(null);
  const soundAnalyzerRef = useRef<SoundAnalyzer | null>(null);
  
  const isMonitoringRef = useRef(isMonitoring);
  const isProcessingImageRef = useRef(false);
  const latestFrameRef = useRef<{ base64: string, mimeType: string } | null>(null);
  const latestAnalysisRef = useRef<ImageAnalysisResult | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const imageLoopTimeoutId = useRef<number | null>(null);
  const verbalLoopTimeoutId = useRef<number | null>(null);
  const imageAnalysisIntervalMs = useRef(1500); // Default: 1.5 seconds
  const verbalAnalysisIntervalMs = useRef(5000); // Default: 5 seconds

  const transcriptBuffer = useRef<string>('');
  
  const addAlert = useCallback((newAlert: Omit<Alert, 'id' | 'timestamp'>) => {
    setAlerts(prev => [
      { 
        ...newAlert,
        id: `${new Date().toISOString()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev
    ].slice(0, 100));
  }, []);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    latestAnalysisRef.current = latestAnalysis;
  }, [latestAnalysis]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        if (!isMonitoringRef.current) return;
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setLatestTranscript(interimTranscript);
        if (finalTranscript.trim()) {
          transcriptBuffer.current += finalTranscript.trim() + ' ';
        }
      };
      
      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.error('Speech recognition error:', event.error);
        setError(`Speech error: ${event.error}`);
      };

      recognition.onend = () => {
          if (isMonitoringRef.current) {
            try { recognition.start(); } catch (e) { console.error("Recognition restart failed", e); }
          }
      };
      speechRecognition.current = recognition;
    } else {
        setError("Speech Recognition API not supported in this browser.");
    }

    return () => {
        if (speechRecognition.current) {
            const wasMonitoring = isMonitoringRef.current;
            isMonitoringRef.current = false;
            if (wasMonitoring) speechRecognition.current.abort();
        }
    };
  }, []);

  const processSound = useCallback((result: SoundAnalysisResult) => {
    const targetSounds = new Set(["Gunshot, gunfire", "Glass", "Shatter", "Yell", "Screaming"]);
    const threshold = 0.6;

    let highestScoreEvent = null;

    for (const event of result) {
      if (targetSounds.has(event.categoryName) && event.score > threshold) {
        if (!highestScoreEvent || event.score > highestScoreEvent.score) {
          highestScoreEvent = event;
        }
      }
    }

    if(highestScoreEvent) {
      if (alerts.length > 0 && alerts[0].type === 'Sound' && alerts[0].title.includes(highestScoreEvent.categoryName)) {
        return;
      }

      addAlert({
        type: 'Sound',
        title: `Sound Detected: ${highestScoreEvent.categoryName}`,
        details: `A sound of "${highestScoreEvent.categoryName}" was detected with a confidence of ${(highestScoreEvent.score * 100).toFixed(0)}%.`
      });
    }
  }, [addAlert, alerts]);

  useEffect(() => {
    const initializeSoundAnalyzer = async () => {
        try {
            soundAnalyzerRef.current = await SoundAnalyzer.create(processSound);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error("Failed to create SoundAnalyzer", e);
            setError("Could not initialize sound analyzer. " + errorMessage);
        }
    };

    initializeSoundAnalyzer();

    return () => {
        soundAnalyzerRef.current?.stop();
    };
  }, [processSound]);

  const captureFrame = useCallback(() => {
    if (!isMonitoringRef.current) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
      return;
    }
    if (monitoringViewRef.current) {
      const frame = monitoringViewRef.current.capture();
      if (frame) {
        latestFrameRef.current = frame;
      }
    }
    animationFrameId.current = requestAnimationFrame(captureFrame);
  }, []);

  const processImage = useCallback(async () => {
    if (!isMonitoringRef.current || isProcessingImageRef.current || !latestFrameRef.current) return;
    
    isProcessingImageRef.current = true;
    setIsProcessing(p => ({ ...p, image: true }));
    const { base64, mimeType } = latestFrameRef.current;
    latestFrameRef.current = null;

    try {
        const result = await analyzeImageContent(base64, mimeType);
        setLatestAnalysis(result);
        
        result.people.forEach(person => {
            if (person.isAggressive) {
                addAlert({ type: 'Aggression', title: `Aggression Detected (${person.id})`, details: person.aggressionAnalysis });
            }
            if(person.heldObject) {
                const obj = person.heldObject;
                if (obj.harmfulUseWarning) {
                     addAlert({ type: 'Object', title: `Contextual Threat: ${obj.name} (${person.id})`, details: obj.harmfulUseWarning });
                } else if (obj.riskScore > 60) {
                     addAlert({ type: 'Object', title: `Risky Object: ${obj.name} (${person.id})`, details: `Risk score: ${obj.riskScore}. Justification: ${obj.justification}` });
                }
            }

            if (person.expression) {
                const isHighRiskExpression = person.expression.sentiment === 'Fearful' || person.expression.sentiment === 'Angry' || person.expression.sentiment === 'Sad';
                const isHighRiskSituation = person.isAggressive || (person.heldObject && person.heldObject.riskScore > 60);

                if (isHighRiskExpression && isHighRiskSituation) {
                    addAlert({
                        type: 'Expression',
                        title: `High-Risk Situation: ${person.expression.sentiment} (${person.id})`,
                        details: `Detected a ${person.expression.sentiment} expression in a high-risk situation. Aggression: ${person.isAggressive}, Held Object Risk: ${person.heldObject?.riskScore || 'N/A'}. Macro: "${person.expression.macroExpression}". Micro: "${person.expression.microExpression}".`
                    });
                }
            }
        });
        
        // Recovery from backoff
        if (imageAnalysisIntervalMs.current > 1500) {
            imageAnalysisIntervalMs.current = Math.max(imageAnalysisIntervalMs.current - 1000, 1500);
            console.log(`Image analysis successful. Reducing interval to ${imageAnalysisIntervalMs.current}ms`);
        }
        setError(prevError => prevError?.startsWith('Image analysis') ? null : prevError);

    } catch (e: any) {
        console.error('Image analysis error:', e);
        const errorMessage = `Image analysis error: ${e?.message || 'A failure occurred'}`;
        
        // Implement backoff if rate limited
        if (e.message?.includes("API rate limit exceeded")) {
            imageAnalysisIntervalMs.current = Math.min(imageAnalysisIntervalMs.current + 5000, 20000); // increase interval, max 20s
            console.warn(`Image rate limit hit. Increasing analysis interval to ${imageAnalysisIntervalMs.current}ms`);
        }
        
        setError(errorMessage);
    } finally {
        isProcessingImageRef.current = false;
        setIsProcessing(p => ({ ...p, image: false }));
    }
  }, [addAlert]);

  const processVerbal = useCallback(async () => {
    if (!isMonitoringRef.current || !transcriptBuffer.current.trim()) return;

    const textToAnalyze = transcriptBuffer.current.trim();
    transcriptBuffer.current = '';

    setIsProcessing(p => ({ ...p, verbal: true }));
    try {
        const result = await analyzeVerbalContent(textToAnalyze);
        if (result.isBullying || result.sentiment === 'Negative' || result.isSarcastic) {
            let alertDetails = `"${textToAnalyze}" - Explanation: ${result.explanation}`;
            if(result.isSarcastic) {
                alertDetails += " (Note: Sarcasm detected)";
            }

            const currentPeople = latestAnalysisRef.current?.people || [];
            const aggressivePeople = currentPeople.filter(p => p.isAggressive);

            if (aggressivePeople.length > 0) {
                // Link verbal threat to all aggressive individuals
                aggressivePeople.forEach(person => {
                    addAlert({ type: 'Verbal', title: `Verbal Threat (${person.id})`, details: alertDetails });
                });
            } else if (currentPeople.length === 1) {
                // If only one person is on screen, attribute to them
                addAlert({ type: 'Verbal', title: `Verbal Threat (${currentPeople[0].id})`, details: alertDetails });
            } else {
                // Otherwise, create a general verbal alert
                addAlert({ type: 'Verbal', title: `Verbal Threat Detected`, details: alertDetails });
            }
        }
        
        // Recovery from backoff
        if (verbalAnalysisIntervalMs.current > 5000) {
            verbalAnalysisIntervalMs.current = Math.max(verbalAnalysisIntervalMs.current - 2000, 5000);
            console.log(`Verbal analysis successful. Reducing interval to ${verbalAnalysisIntervalMs.current}ms`);
        }
        setError(prevError => prevError?.startsWith('Verbal analysis') ? null : prevError);

    } catch (e: any) {
        console.error('Verbal analysis error:', e);
        const errorMessage = `Verbal analysis error: ${e?.message || 'A failure occurred'}`;
        
        // Implement backoff if rate limited
        if (e.message?.includes("API rate limit exceeded")) {
            verbalAnalysisIntervalMs.current = Math.min(verbalAnalysisIntervalMs.current + 5000, 25000); // increase interval, max 25s
            console.warn(`Verbal rate limit hit. Increasing analysis interval to ${verbalAnalysisIntervalMs.current}ms`);
        }

        setError(errorMessage);
    } finally {
        setIsProcessing(p => ({ ...p, verbal: false }));
    }
  }, [addAlert]);

  useEffect(() => {
    const runImageLoop = () => {
        if (!isMonitoringRef.current) {
            if (imageLoopTimeoutId.current) clearTimeout(imageLoopTimeoutId.current);
            return;
        }
        processImage().finally(() => {
            if (isMonitoringRef.current) {
                imageLoopTimeoutId.current = window.setTimeout(runImageLoop, imageAnalysisIntervalMs.current);
            }
        });
    };

    if (isMonitoring) {
        runImageLoop();
    } else {
      if(imageLoopTimeoutId.current) clearTimeout(imageLoopTimeoutId.current);
    }
    return () => { if (imageLoopTimeoutId.current) clearTimeout(imageLoopTimeoutId.current); }
  }, [isMonitoring, processImage]);

  useEffect(() => {
    const runVerbalLoop = () => {
        if (!isMonitoringRef.current) {
            if (verbalLoopTimeoutId.current) clearTimeout(verbalLoopTimeoutId.current);
            return;
        }
        processVerbal().finally(() => {
            if (isMonitoringRef.current) {
                verbalLoopTimeoutId.current = window.setTimeout(runVerbalLoop, verbalAnalysisIntervalMs.current);
            }
        });
    };
    
    if (isMonitoring) {
      // Start verbal loop with an initial delay to avoid startup burst
      verbalLoopTimeoutId.current = window.setTimeout(runVerbalLoop, 2000);
    } else {
      if (verbalLoopTimeoutId.current) clearTimeout(verbalLoopTimeoutId.current);
    }
    return () => { if (verbalLoopTimeoutId.current) clearTimeout(verbalLoopTimeoutId.current); }
  }, [isMonitoring, processVerbal]);


  const toggleMonitoring = useCallback(async () => {
    setError(null);
    if (isMonitoring) {
        isMonitoringRef.current = false; // Set ref immediately
        if (speechRecognition.current) { speechRecognition.current.abort(); }
            soundAnalyzerRef.current?.stop();
        monitoringViewRef.current?.stopCamera();
        if (animationFrameId.current) { cancelAnimationFrame(animationFrameId.current); animationFrameId.current = null; }
        if (imageLoopTimeoutId.current) clearTimeout(imageLoopTimeoutId.current);
        if (verbalLoopTimeoutId.current) clearTimeout(verbalLoopTimeoutId.current);

        imageAnalysisIntervalMs.current = 1500;
        verbalAnalysisIntervalMs.current = 5000;

        transcriptBuffer.current = '';
        setLatestAnalysis(null);
        setLatestTranscript('');
        setIsMonitoring(false);
    } else {
        setAlerts([]);
        const cameraReady = await monitoringViewRef.current?.startCamera();
        if (cameraReady) {
            if(speechRecognition.current) {
                try { speechRecognition.current.start(); }
                catch(err) { console.error("Could not start speech recognition", err); setError("Could not start speech recognition. Please check microphone permissions."); }
            } else { setError("Speech Recognition not initialized."); }

            try {
                await soundAnalyzerRef.current?.start();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error("Could not start sound analysis", err);
                setError("Could not start sound analysis. " + errorMessage);
            }

            isMonitoringRef.current = true;
            setIsMonitoring(true);
            captureFrame();
        }
    }
  }, [isMonitoring, captureFrame]);
  
  const handleResetSession = useCallback(() => {
    if (alerts.length === 0) return;

    const aggressionCount = alerts.filter(a => a.type === 'Aggression').length;
    const verbalCount = alerts.filter(a => a.type === 'Verbal').length;
    const objectCount = alerts.filter(a => a.type === 'Object').length;
    const soundCount = alerts.filter(a => a.type === 'Sound').length;
    const expressionCount = alerts.filter(a => a.type === 'Expression').length;

    const newSession: Session = {
      id: `session-${Date.now()}`,
      savedAt: new Date().toLocaleString(),
      alerts: [...alerts].reverse(), // Save in chronological order
      summary: {
        aggression: aggressionCount,
        verbal: verbalCount,
        objects: objectCount,
        sound: soundCount,
        expression: expressionCount,
      }
    };
    
    setHistory(prev => [newSession, ...prev]);
    setAlerts([]);
  }, [alerts]);

  const toggleHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(prev => !prev);
  }, []);


  return (
    <div className="bg-[var(--c-bg)] text-[var(--c-text-primary)] h-screen w-screen flex flex-col antialiased overflow-hidden">
      <Header 
        isMonitoring={isMonitoring} 
        onToggleMonitoring={toggleMonitoring} 
        alerts={alerts}
        onResetSession={handleResetSession}
        onToggleHistory={toggleHistoryModal}
      />
      <main className="flex-1 grid grid-cols-5 gap-4 lg:gap-6 p-4 lg:p-6 overflow-hidden">
        {error && (
            <div className="col-span-full bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative animate-fade-in flex justify-between items-center" role="alert">
                <div>
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
                <button className="p-1 rounded-full hover:bg-red-800/50" onClick={() => setError(null)}>
                    <svg className="fill-current h-5 w-5 text-red-400" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                </button>
            </div>
        )}
        <div className="col-span-full lg:col-span-3 flex flex-col min-h-0">
          <LiveMonitoringView 
              ref={monitoringViewRef}
              isMonitoring={isMonitoring}
              isProcessing={isProcessing}
              latestTranscript={latestTranscript}
              latestAnalysis={latestAnalysis}
          />
        </div>
        <div className="col-span-full lg:col-span-2 flex flex-col min-h-0">
            <EventLog alerts={alerts} />
        </div>
      </main>
      {isHistoryModalOpen && (
        <HistoryModal sessions={history} onClose={toggleHistoryModal} />
      )}
    </div>
  );
}

export default App;