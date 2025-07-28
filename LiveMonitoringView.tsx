import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from 'react';
import Spinner from './Spinner';
import { CameraIcon } from './icons/Icons';
import type { ImageAnalysisResult, Location, Person } from '../types';

interface LiveMonitoringViewProps {
  isMonitoring: boolean;
  isProcessing: { image: boolean; verbal: boolean };
  latestTranscript: string;
  latestAnalysis: ImageAnalysisResult | null;
}

export interface LiveMonitoringViewRef {
    capture: () => { base64: string, mimeType: string } | null;
    startCamera: () => Promise<boolean>;
    stopCamera: () => void;
}

interface Annotation {
    id: string;
    location: Location;
    text: string;
    level: 'threat' | 'warning' | 'info';
}

const AnnotationBox: React.FC<{ annotation: Annotation }> = ({ annotation }) => {
    const levelClasses = {
        threat: { border: 'border-[var(--c-danger)]', bg: 'bg-red-900/80', text: 'text-red-100' },
        warning: { border: 'border-[var(--c-warning)]', bg: 'bg-yellow-900/80', text: 'text-yellow-100' },
        info: { border: 'border-[var(--c-info)]', bg: 'bg-sky-900/80', text: 'text-sky-100' },
    };
    const { border, bg, text } = levelClasses[annotation.level];

    return (
        <div 
            className={`absolute rounded-md border-2 shadow-lg animate-fade-in ${border}`}
            style={{
                left: `${annotation.location.x * 100}%`,
                top: `${annotation.location.y * 100}%`,
                width: `${annotation.location.width * 100}%`,
                height: `${annotation.location.height * 100}%`,
                pointerEvents: 'none',
            }}
        >
            <div className={`absolute -top-0.5 left-1.5 px-1.5 py-0.5 rounded-sm ${bg}`}>
                 <span className={`text-xs font-bold whitespace-nowrap ${text}`}>{annotation.text}</span>
            </div>
        </div>
    );
};

const StatusIndicator: React.FC<{ label: string; isProcessing: boolean }> = ({ label, isProcessing }) => (
    <div className="flex items-center gap-2">
        <span className="text-slate-300 text-xs">{label}:</span>
        {isProcessing ? (
            <div className="flex items-center gap-1 text-[var(--c-accent)]">
                <Spinner />
                <span className="text-xs">Processing...</span>
            </div>
        ) : (
            <span className="text-green-400 text-xs">Active</span>
        )}
    </div>
);


const LiveMonitoringView = forwardRef<LiveMonitoringViewRef, LiveMonitoringViewProps>(({
    isMonitoring,
    isProcessing,
    latestTranscript,
    latestAnalysis
}, ref) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const annotationClearTimer = useRef<number | null>(null);

  useEffect(() => {
    if (annotationClearTimer.current) clearTimeout(annotationClearTimer.current);

    if (!latestAnalysis || !latestAnalysis.people) {
        setAnnotations([]);
        return;
    }

    const newAnnotations: Annotation[] = [];
    
    latestAnalysis.people.forEach((person: Person) => {
        // Always add a box for the person
        newAnnotations.push({
            id: person.id,
            location: person.location,
            text: person.id,
            level: 'info'
        });

        if (person.isAggressive) {
            newAnnotations.push({
                id: `${person.id}-agg`,
                location: person.location,
                text: `AGGRESSION`,
                level: 'threat'
            });
        }

        // Create a separate annotation for the held object using its own location
        if (person.heldObject?.location) {
            const obj = person.heldObject;
            let level: 'threat' | 'warning' | 'info' = 'info';
            let text = `${obj.name}`;

            if (obj.harmfulUseWarning) {
                level = 'threat';
                text = `WARNING: ${obj.name}`;
            } else if (obj.riskScore > 60) {
                level = 'warning';
                text = `RISK: ${obj.name} (${obj.riskScore})`;
            }
            
            newAnnotations.push({
                id: `${person.id}-obj`,
                location: obj.location, // Use the object's own location
                text: text,
                level: level
            });
        }
    });

    setAnnotations(newAnnotations);
    
    annotationClearTimer.current = window.setTimeout(() => {
        setAnnotations([]);
    }, 4000);

    return () => { if (annotationClearTimer.current) clearTimeout(annotationClearTimer.current) };

  }, [latestAnalysis]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setAnnotations([]);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [stream]);

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null);
    if (stream) return true;
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(cameraStream);
      return true;
    } catch (err) {
      console.error("Error accessing camera:", err);
      const errorMessage = err instanceof Error ? err.name : String(err);
       if (errorMessage === 'NotAllowedError' || errorMessage === 'PermissionDeniedError') {
           setCameraError("Camera permission was denied. Please grant permission in your browser settings and refresh.");
      } else {
           setCameraError("Could not access camera. Please ensure it is not used by another app and permissions are granted.");
      }
      return false;
    }
  }, [stream]);

  useImperativeHandle(ref, () => ({
    capture: () => {
      if (!videoRef.current) return null;
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn("Capture failed: video dimensions are zero.");
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];
      return { base64, mimeType: 'image/jpeg' };
    },
    startCamera,
    stopCamera
  }));

  return (
    <div className="bg-[var(--c-surface)] rounded-xl p-2 sm:p-4 shadow-lg flex-1 flex flex-col min-h-[300px] sm:min-h-[400px]">
        <h2 className="text-lg font-bold text-white mb-4 px-2">Live Feed</h2>
        <div className="relative bg-black rounded-lg w-full flex-1 overflow-hidden">
            {!stream ? (
            <div className="flex flex-col items-center justify-center w-full h-full text-center">
                <CameraIcon className="w-16 h-16 text-slate-600" />
                <p className="text-slate-400 mt-4">Camera is offline</p>
                {cameraError && <p className="text-red-400 mt-2 text-sm max-w-sm">{cameraError}</p>}
            </div>
            ) : (
            <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                {annotations.map(ann => <AnnotationBox key={ann.id} annotation={ann} />)}
                {isMonitoring && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-2 text-sm animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-between gap-2">
                             <div className="flex items-center gap-4">
                                <StatusIndicator label="Image" isProcessing={isProcessing.image} />
                                <StatusIndicator label="Verbal" isProcessing={isProcessing.verbal} />
                            </div>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <p className="text-slate-300 text-xs flex-shrink-0">Transcript:</p>
                                <p className="text-slate-100 font-mono text-xs flex-1 truncate">
                                    {latestTranscript || "Listening..."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </>
            )}
        </div>
    </div>
  );
});

export default LiveMonitoringView;