import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { FaceCaptureModalProps } from './FaceCaptureModal';

// PERF FIX (audit): FaceCaptureModal statically pulls in @vladmandic/face-api
// (multi-MB) via faceRecognitionEngine. Because <Header> renders on every
// authenticated page and imported the modal directly, face-api was forced into
// the initial bundle even though the camera modal is rarely opened.
//
// This wrapper is a drop-in replacement that exports the SAME `FaceCaptureModal`
// name and props. The heavy module is loaded on demand only the first time the
// modal is actually opened. Once opened, the inner component stays mounted so
// its internal AnimatePresence-driven open/close transitions keep working
// exactly as before — we only defer the very first load, we don't change
// runtime behavior after that.
const FaceCaptureModalInner = lazy(() =>
  import('./FaceCaptureModal').then((m) => ({ default: m.FaceCaptureModal }))
);

export const FaceCaptureModal: React.FC<FaceCaptureModalProps> = (props) => {
  const [everOpened, setEverOpened] = useState<boolean>(!!props.isOpen);

  useEffect(() => {
    if (props.isOpen && !everOpened) {
      setEverOpened(true);
    }
  }, [props.isOpen, everOpened]);

  // Never loaded the heavy chunk yet and not being opened → render nothing.
  if (!everOpened) return null;

  return (
    <Suspense fallback={null}>
      <FaceCaptureModalInner {...props} />
    </Suspense>
  );
};

export default FaceCaptureModal;
