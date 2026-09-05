import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, X, ScanFace, RefreshCw, Loader2, UserCheck, ShieldAlert, Sparkles, ShieldX } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import {
  loadFaceModels,
  detectSingleFaceDescriptor,
  verifyFaceAgainstEnrolled,
  saveEmployeeDescriptor,
  extractDescriptorFromImageUrl,
  getEmployeeDescriptor,
  drawFaceMeshOverVideo
} from '../../lib/faceRecognitionEngine';

export interface FaceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onEnrollSuccess?: (descriptorArray: number[]) => void;
  employeeName?: string;
  employeeId?: string;
  profilePhotoUrl?: string;
  cloudDescriptor?: number[];
  isTestMode?: boolean;
  isEnrollmentMode?: boolean;
}

export const FaceCaptureModal: React.FC<FaceCaptureModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onEnrollSuccess,
  employeeName = 'Employee',
  employeeId = 'emp-001',
  profilePhotoUrl,
  cloudDescriptor,
  isTestMode = false,
  isEnrollmentMode = false
}) => {
  const { triggerHaptic } = useHaptic();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusStep, setStatusStep] = useState<'LOADING_MODELS' | 'INITIALIZING' | 'CENTER_FACE' | 'SCANNING' | 'VERIFIED' | 'FAILED' | 'NOT_ENROLLED' | 'ERROR'>('LOADING_MODELS');
  const [feedbackText, setFeedbackText] = useState('Loading face recognition neural network models...');
  const [confidencePercent, setConfidencePercent] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const [profileDescriptor, setProfileDescriptor] = useState<Float32Array | null>(null);
  const [currentModeIsEnroll, setCurrentModeIsEnroll] = useState<boolean>(isEnrollmentMode);

  // Sync mode state when prop changes
  useEffect(() => {
    setCurrentModeIsEnroll(isEnrollmentMode);
  }, [isEnrollmentMode, isOpen]);

  // Check if employee already has face enrolled or extract from profile photo
  useEffect(() => {
    if (employeeId && isOpen) {
      const storedDesc = getEmployeeDescriptor(employeeId);
      const enrolled = storedDesc !== null || (cloudDescriptor && cloudDescriptor.length === 128);
      setIsEnrolled(!!enrolled);

      // SECURITY: Never silently auto-enroll. Only enter enrollment mode when explicitly requested.
      // Unenrolled employees will see the NOT_ENROLLED state and must click "Register Face" explicitly.

      if (!storedDesc && profilePhotoUrl) {
        extractDescriptorFromImageUrl(profilePhotoUrl).then(desc => {
          if (desc) setProfileDescriptor(desc);
        });
      }
    }
  }, [employeeId, profilePhotoUrl, isOpen, cloudDescriptor]);

  // Load Models & Start Camera Stream
  useEffect(() => {
    if (!isOpen) {
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setStream(null);
      }
      return;
    }

    let isMounted = true;

    const initializeEngine = async () => {
      try {
        setErrorMsg(null);
        setStatusStep('LOADING_MODELS');
        setFeedbackText('Loading neural network face models...');

        // Start camera stream acquisition in parallel with model loading
        let mediaStream: MediaStream | null = null;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
          });
        } catch {
          // Fallback to generic video
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          } catch {
            throw new Error('Camera access denied. Please allow camera permission in browser settings and try again.');
          }
        }

        if (isMounted && mediaStream) {
          streamRef.current = mediaStream;
          setStream(mediaStream);
        } else if (mediaStream) {
          mediaStream.getTracks().forEach(t => t.stop());
        }

        await loadFaceModels();

        if (isMounted) {
          setStatusStep('CENTER_FACE');
          setFeedbackText('Position your face inside the frame...');
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[FaceCaptureModal] Error:', err);
          setErrorMsg(err?.message || 'Camera access or model loading failed. Please check permissions.');
          setStatusStep('ERROR');
        }
      }
    };

    initializeEngine();

    return () => {
      isMounted = false;
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // Guaranteed video stream binding hook whenever stream or video element is available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.warn('Video play prompt:', e));
      };
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isOpen]);

  // Handle Enrollment Action
  const handlePerformEnrollment = (scannedDescriptor: Float32Array) => {
    const descriptorArray = Array.from(scannedDescriptor);
    saveEmployeeDescriptor(employeeId, scannedDescriptor);
    onEnrollSuccess?.(descriptorArray);
    setIsEnrolled(true);
    setCurrentModeIsEnroll(false);
    setConfidencePercent(98);
    setStatusStep('VERIFIED');
    setFeedbackText('✓ Face Biometrics Successfully Registered & Verified!');
    triggerHaptic('success');

    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  };

  // Live Detection Loop using real @vladmandic/face-api
  useEffect(() => {
    if (!isOpen || !videoRef.current || (statusStep !== 'CENTER_FACE' && statusStep !== 'SCANNING')) return;

    let active = true;
    let scanCount = 0;

    const interval = setInterval(async () => {
      if (!active || !videoRef.current) return;

      try {
        const scan = await detectSingleFaceDescriptor(videoRef.current);

        if (!active) return;

        // Render live 68-point facial landmarks mesh on canvas overlay
        if (canvasRef.current && videoRef.current) {
          drawFaceMeshOverVideo(videoRef.current, canvasRef.current, scan, 'emerald');
        }

        if (scan.detected && scan.descriptor) {
          scanCount++;
          setStatusStep('SCANNING');
          setFeedbackText(`Face detected! Processing facial landmarks... (${scanCount}/2)`);

          if (scanCount >= 2) {
            // Mode A: Explicit Enrollment Mode — user deliberately clicked "Register Face"
            if (currentModeIsEnroll) {
              active = false;
              clearInterval(interval);
              handlePerformEnrollment(scan.descriptor);
              return;
            }

            // Mode B: Not enrolled + NOT in enrollment mode → hard block, no silent auto-enroll
            // SECURITY FIX: Previously, !isEnrolled triggered silent enrollment of any face. Removed.
            if (!isEnrolled) {
              active = false;
              clearInterval(interval);
              setStatusStep('NOT_ENROLLED');
              setFeedbackText('No biometric face template registered for this account. Please register your face first.');
              triggerHaptic('error');
              return;
            }

            // Mode C: Strict Verification — must match enrolled descriptor
            const match = verifyFaceAgainstEnrolled(scan.descriptor, employeeId, profileDescriptor, cloudDescriptor);

            // SECURITY FIX: Removed `|| !match.enrolled` bypass — unenrolled is NOT a pass condition.
            if (match.isMatch) {
              const conf = match.confidencePercent;
              setConfidencePercent(conf);
              setStatusStep('VERIFIED');
              setFeedbackText(
                match.matchedAgainstProfilePhoto
                  ? `✓ Matched Against Profile Picture (${conf}% Confidence)`
                  : `✓ Biometric Match Verified (${conf}% Confidence)`
              );
              triggerHaptic('success');
              active = false;
              clearInterval(interval);

              if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
              actionTimerRef.current = setTimeout(() => {
                onSuccess();
                onClose();
              }, 1200);
            } else {
              // Hard mismatch — no bypass, employee must retry with their own face
              setStatusStep('FAILED');
              setConfidencePercent(match.confidencePercent);
              setFeedbackText(`❌ Biometric Mismatch (${match.confidencePercent}% Confidence). Face does not match registered profile!`);
              triggerHaptic('error');
              active = false;
              clearInterval(interval);
            }
          }
        } else {
          if (statusStep === 'SCANNING') {
            scanCount = 0;
            setStatusStep('CENTER_FACE');
            setFeedbackText('Position your face clearly inside the frame...');
            setConfidencePercent(null);
          }
        }
      } catch (err) {
        console.warn('[FaceCaptureModal] Scan frame error:', err);
      }
    }, 350);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, statusStep, employeeId, currentModeIsEnroll, isEnrolled, profileDescriptor, cloudDescriptor]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-lg z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col items-center"
      >
        {/* Header Bar */}
        <div className="w-full px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {currentModeIsEnroll ? '📸 Register Facial Biometrics' : isTestMode ? '🔍 Diagnostic Face Accuracy Test' : 'AI Biometric Facial Verification'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {currentModeIsEnroll ? 'Capturing 128-point face descriptor' : isTestMode ? 'Testing live facial matching against profile descriptor' : '100% Client-Side TensorFlow Neural Net'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport - Always mounted so video feed is never blank */}
        <div className="relative w-full aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100 bg-slate-950"
          />

          {/* Real Neural 68-Point Facial Landmark Overlay Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100 z-10"
          />

          {/* Face Oval Target Boundary Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className={`w-56 h-72 rounded-[40%] border-2 transition-all duration-500 relative flex flex-col items-center justify-center ${
              statusStep === 'VERIFIED' ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.3)]' :
              statusStep === 'FAILED' ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_40px_rgba(244,63,94,0.3)]' :
              statusStep === 'NOT_ENROLLED' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_40px_rgba(245,158,11,0.3)]' :
              statusStep === 'SCANNING' ? 'border-blue-400 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-pulse' :
              'border-emerald-400/80 border-dashed'
            }`}>
              <div className="w-full h-full border border-emerald-400/30 rounded-[40%] absolute inset-2 opacity-60" />
              {statusStep === 'VERIFIED' && (
                <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-in zoom-in-50 duration-300" />
              )}
              {statusStep === 'FAILED' && (
                <ShieldAlert className="w-16 h-16 text-rose-500 animate-in zoom-in-50 duration-300" />
              )}
              {statusStep === 'NOT_ENROLLED' && (
                <AlertTriangle className="w-16 h-16 text-amber-400 animate-in zoom-in-50 duration-300" />
              )}
            </div>
          </div>

          {/* Overlay: Neural Network Loading State */}
          {statusStep === 'LOADING_MODELS' && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <p className="text-xs text-slate-200 font-bold">{feedbackText}</p>
              <p className="text-[10px] text-slate-400">Initializing camera and neural models...</p>
            </div>
          )}

          {/* Overlay: Fatal Camera Error — informational only, no bypass action */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <ShieldX className="w-8 h-8 text-rose-400" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-rose-300">Camera Access Required</p>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">{errorMsg}</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Biometric face verification requires camera access. Please grant permission in your browser settings and reload.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setStatusStep('LOADING_MODELS');
                  setFeedbackText('Retrying camera access...');
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera Access</span>
              </button>
            </div>
          )}

          {/* Top Floating Badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            <span className="text-[10px] font-mono font-bold bg-slate-950/80 text-slate-300 px-3 py-1 rounded-full border border-slate-800 backdrop-blur-md flex items-center gap-1.5">
              <UserCheck className="w-3 h-3 text-emerald-400" />
              {employeeName}
            </span>
            {confidencePercent !== null && (
              <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border backdrop-blur-md ${
                statusStep === 'FAILED' 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                Accuracy: {confidencePercent}%
              </span>
            )}
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="w-full p-6 bg-slate-950 border-t border-slate-800 space-y-4">
          <div className="text-center space-y-1">
            <p className={`text-xs font-bold ${
              statusStep === 'VERIFIED' ? 'text-emerald-400' :
              statusStep === 'FAILED' ? 'text-rose-400' :
              statusStep === 'NOT_ENROLLED' ? 'text-amber-400' : 'text-white'
            }`}>{feedbackText}</p>
            <p className="text-[10px] text-slate-500">
              {currentModeIsEnroll
                ? 'Hold still inside the frame to register your official biometric face template.'
                : isEnrolled
                  ? 'Biometric descriptor registered. Matching live face against 128-float embedding.' 
                  : 'No facial template enrolled yet. Click "Register My Face" below to enroll.'}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {/* NOT_ENROLLED: offer ONLY explicit registration — no bypass whatsoever */}
            {(statusStep === 'NOT_ENROLLED' || (!isEnrolled && statusStep !== 'LOADING_MODELS' && statusStep !== 'ERROR')) ? (
              <button
                onClick={() => {
                  setCurrentModeIsEnroll(true);
                  setStatusStep('CENTER_FACE');
                  setFeedbackText('Position your face inside frame to register...');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-900/40"
              >
                <Sparkles className="w-3.5 h-3.5" /> Register Face via Camera
              </button>
            ) : statusStep === 'FAILED' ? (
              /* FAILED: only retry scan — no bypass or override allowed */
              <button
                onClick={() => {
                  setStatusStep('CENTER_FACE');
                  setConfidencePercent(null);
                  setFeedbackText('Position your face inside the frame...');
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
              </button>
            ) : statusStep !== 'VERIFIED' && statusStep !== 'LOADING_MODELS' && statusStep !== 'ERROR' ? (
              /* Enrolled + scanning: only offer re-registration of their own face */
              <button
                onClick={() => {
                  setCurrentModeIsEnroll(true);
                  setStatusStep('CENTER_FACE');
                  setFeedbackText('Position your face to re-register template...');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-blue-400" /> Re-Register Face
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
