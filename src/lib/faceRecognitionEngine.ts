// 100% Client-Side Real Facial Recognition Engine
// Powered by @vladmandic/face-api (TensorFlow.js backend)
// Provides 128-float biometric embedding vector extraction & euclidean distance matching

import * as faceapi from '@vladmandic/face-api';

const MODEL_URLS = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/',
  'https://raw.githubusercontent.com/vladmandic/face-api/master/model/',
  'https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model/'
];

let isModelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

// Initialize and load lightweight face recognition models with multi-CDN fallback
export const loadFaceModels = async (): Promise<void> => {
  if (isModelsLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    for (const url of MODEL_URLS) {
      try {
        console.log(`[FaceEngine] Loading neural face models from ${url}...`);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(url),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(url),
          faceapi.nets.faceRecognitionNet.loadFromUri(url)
        ]);
        isModelsLoaded = true;
        console.log('[FaceEngine] Neural face models loaded successfully into memory!');
        return;
      } catch (err) {
        console.warn(`[FaceEngine] CDN source ${url} failed, trying next fallback...`, err);
      }
    }
    // Fallback: mark loaded if nets are loaded in background
    if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
      isModelsLoaded = true;
      return;
    }
    modelLoadingPromise = null;
    throw new Error('Could not load face recognition neural models from CDN sources.');
  })();

  return modelLoadingPromise;
};

// Automatic background preload on idle browser time so biometric modals open with 0ms delay
if (typeof window !== 'undefined') {
  const idlePreload = () => {
    loadFaceModels().catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(idlePreload, { timeout: 3000 });
  } else {
    setTimeout(idlePreload, 1000);
  }
}

export interface FaceScanResult {
  detected: boolean;
  descriptor?: Float32Array;
  detectionBox?: { x: number; y: number; width: number; height: number };
  score?: number;
  landmarks?: faceapi.FaceLandmarks68;
  fullResult?: any;
}

// Extract real 128-point face descriptor vector from a live HTMLVideoElement
export const detectSingleFaceDescriptor = async (
  video: HTMLVideoElement
): Promise<FaceScanResult> => {
  if (!isModelsLoaded) {
    await loadFaceModels();
  }

  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { detected: false };
  }

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
    const result = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!result) {
      return { detected: false };
    }

    const { box, score } = result.detection;
    return {
      detected: true,
      descriptor: result.descriptor,
      detectionBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      score,
      landmarks: result.landmarks,
      fullResult: result
    };
  } catch (err) {
    console.warn('[FaceEngine] detectSingleFace error:', err);
    return { detected: false };
  }
};

// Render real-time 68-point facial landmark mesh & bounding box on a target HTMLCanvasElement
export const drawFaceMeshOverVideo = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  scanResult: FaceScanResult,
  color: 'emerald' | 'rose' | 'blue' = 'emerald'
): void => {
  if (!scanResult.detected || !scanResult.fullResult || !canvas || !video) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  try {
    const displaySize = { 
      width: video.clientWidth || video.videoWidth || 640, 
      height: video.clientHeight || video.videoHeight || 480 
    };
    faceapi.matchDimensions(canvas, displaySize);

    const resizedResult = faceapi.resizeResults(scanResult.fullResult, displaySize);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Draw face landmarks (eye dots, nose bridge, lip contour)
    const drawOptions = {
      drawLines: true,
      lineWidth: 1.5,
      color: color === 'rose' ? '#f43f5e' : color === 'blue' ? '#3b82f6' : '#10b981'
    };
    
    const landmarkDrawBox = new faceapi.draw.DrawFaceLandmarks(resizedResult.landmarks, drawOptions);
    landmarkDrawBox.draw(canvas);
  } catch {}
};

// Extract face descriptor from an image URL (e.g. Employee's official profile photo)
export const extractDescriptorFromImageUrl = async (
  imageUrl: string
): Promise<Float32Array | null> => {
  try {
    if (!isModelsLoaded) await loadFaceModels();
    const img = await faceapi.fetchImage(imageUrl);
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
    const result = await faceapi
      .detectSingleFace(img, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    return result ? result.descriptor : null;
  } catch (err) {
    console.warn('[FaceEngine] Could not extract descriptor from profile photo URL:', err);
    return null;
  }
};

// Biometric Profile Storage (IndexedDB / localStorage fallback)
const STORAGE_PREFIX = 'kss_face_descriptor_v1_';
const inMemoryDescriptorCache = new Map<string, Float32Array>();

export const clearAllFaceEngineState = (): void => {
  inMemoryDescriptorCache.clear();
  console.log('[FaceEngine] Cleared in-memory face descriptor cache on logout.');
};

export const saveEmployeeDescriptor = (employeeId: string, descriptor: Float32Array): void => {
  const arrayData = Array.from(descriptor);
  inMemoryDescriptorCache.set(employeeId, descriptor);
  localStorage.setItem(`${STORAGE_PREFIX}${employeeId}`, JSON.stringify(arrayData));
};

export const getEmployeeDescriptor = (employeeId: string, cloudDescriptor?: number[]): Float32Array | null => {
  if (inMemoryDescriptorCache.has(employeeId)) {
    return inMemoryDescriptorCache.get(employeeId)!;
  }

  const stored = localStorage.getItem(`${STORAGE_PREFIX}${employeeId}`);
  if (stored) {
    try {
      const arrayData = JSON.parse(stored) as number[];
      const vec = new Float32Array(arrayData);
      inMemoryDescriptorCache.set(employeeId, vec);
      return vec;
    } catch {}
  }
  
  if (cloudDescriptor && cloudDescriptor.length > 0) {
    // Restore from Cloud Firestore backup!
    const vec = new Float32Array(cloudDescriptor);
    saveEmployeeDescriptor(employeeId, vec);
    return vec;
  }

  return null;
};

export const clearEmployeeDescriptor = (employeeId: string): void => {
  inMemoryDescriptorCache.delete(employeeId);
  localStorage.removeItem(`${STORAGE_PREFIX}${employeeId}`);
};

export interface MatchVerificationResult {
  isMatch: boolean;
  confidencePercent: number;
  distance: number;
  enrolled: boolean;
  matchedAgainstProfilePhoto?: boolean;
  message?: string;
}

// Compare scanned face descriptor strictly against employee's enrolled descriptor or profile photo
// Euclidean distance threshold: < 0.58 = MATCH, >= 0.58 = MISMATCH
export const verifyFaceAgainstEnrolled = (
  scannedDescriptor: Float32Array,
  employeeId: string,
  profilePhotoDescriptor?: Float32Array | null,
  cloudDescriptor?: number[]
): MatchVerificationResult => {
  let referenceDescriptor = getEmployeeDescriptor(employeeId, cloudDescriptor);
  let isProfilePhoto = false;

  // Fallback to Profile Photo descriptor if no local biometric enrolled yet
  if (!referenceDescriptor && profilePhotoDescriptor) {
    referenceDescriptor = profilePhotoDescriptor;
    isProfilePhoto = true;
  }

  // If NO reference is enrolled or available for this employee:
  if (!referenceDescriptor) {
    return {
      isMatch: false,
      confidencePercent: 0,
      distance: 1.0,
      enrolled: false,
      message: 'No face template enrolled for this account yet.'
    };
  }

  // Calculate Euclidean Distance between 128-float descriptors
  const distance = faceapi.euclideanDistance(scannedDescriptor, referenceDescriptor);
  const isMatch = distance < 0.58;
  
  let confidencePercent = 0;
  if (isMatch) {
    confidencePercent = Math.max(82, Math.min(99, Math.round((1 - distance / 0.65) * 100)));
  } else {
    confidencePercent = Math.max(5, Math.min(45, Math.round((1 - distance) * 100)));
  }

  return {
    isMatch,
    confidencePercent,
    distance,
    enrolled: true,
    matchedAgainstProfilePhoto: isProfilePhoto
  };
};
