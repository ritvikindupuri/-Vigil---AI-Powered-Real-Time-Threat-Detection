export interface Location {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  name: string;
  riskScore: number;
  justification: string;
  location: Location;
  harmfulUseWarning?: string;
}

export interface Person {
  id: string;
  location: Location;
  isAggressive: boolean;
  aggressionAnalysis: string;
  heldObject: DetectedObject | null;
}

export interface ImageAnalysisResult {
  people: Person[];
}

export interface VerbalAnalysisResult {
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  isBullying: boolean;
  explanation: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  type: 'Aggression' | 'Verbal' | 'Object';
  title: string;
  details: string;
}

export interface Session {
  id: string;
  savedAt: string;
  alerts: Alert[];
  summary: {
    aggression: number;
    verbal: number;
    objects: number;
  };
}