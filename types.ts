export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl: string;
  fileName: string;
  width: number;
  height: number;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number; // 0 to 100
  totalImages: number;
  completedImages: number;
}

// Parameters from the Python script provided
export interface AlgorithmParams {
  colorTolerance: number;
  fadeStrength: number;
  shavePx: number;
  featherWidth: number;
  objectThreshold: number;
  edgeDesat: number;
  edgeDark: number;
  globalDarkFactor: number;
  alphaBoost: number; // Multiplier to increase shadow density
  autoDetectBg: boolean;
  manualBgColor: [number, number, number];
}