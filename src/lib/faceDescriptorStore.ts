// Biometric descriptor storage (in-memory cache + localStorage).
//
// PERF FIX (audit): these helpers are intentionally split OUT of
// faceRecognitionEngine.ts so that importing them does NOT pull in the
// multi-MB @vladmandic/face-api bundle. AuthContext (root provider, loaded on
// every page) and EmployeePortal only need this lightweight storage — they must
// never drag TensorFlow face models into the initial bundle. Only code that
// actually runs face detection/matching imports faceRecognitionEngine.
//
// faceRecognitionEngine re-exports everything here, so existing imports from
// that module keep working unchanged.

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
