import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  User, 
  Building2, 
  Compass, 
  RotateCcw,
  Sparkles,
  Camera,
  CameraOff
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanState } from 'html5-qrcode';

export const QrScannerKiosk: React.FC = () => {
  const { employees, recordCheckIn, recordCheckOut, settings, companyWorkZone } = useAuth();

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'requesting' | 'acquired' | 'denied'>('requesting');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'error' | 'warning';
    action?: 'CHECK_IN' | 'CHECK_OUT';
    title: string;
    message: string;
    empName?: string;
    empCode?: string;
    timestamp?: string;
  } | null>(null);

  const activeLat = companyWorkZone.latitude ?? settings.officeLatitude ?? 13.0143043;
  const activeLng = companyWorkZone.longitude ?? settings.officeLongitude ?? 77.6459944;

  // Request browser geolocation on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationStatus('acquired');
        },
        err => {
          console.warn('Geolocation permission denied or unhandled:', err.message);
          // Fallback to configured office location for kiosk mode if browser blocks
          setUserLocation({ lat: activeLat, lon: activeLng });
          setLocationStatus('acquired');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setUserLocation({ lat: activeLat, lon: activeLng });
      setLocationStatus('acquired');
    }
  }, [activeLat, activeLng]);

  const handleExecuteScan = (qrTextOrEmpId: string) => {
    setScanResult(null);

    // Try finding by ID, employeeId (code), or matching QR token
    const emp = employees.find(e => 
      e.id === qrTextOrEmpId || 
      e.employeeId === qrTextOrEmpId || 
      e.qrToken === qrTextOrEmpId ||
      qrTextOrEmpId.includes(e.employeeId)
    );

    if (!emp) {
      setScanResult({
        status: 'error',
        title: 'Unrecognized Employee QR',
        message: `No active employee account matched scanned QR payload: "${qrTextOrEmpId}".`
      });
      return;
    }

    const lat = userLocation?.lat ?? activeLat;
    const lon = userLocation?.lon ?? activeLng;

    // First try check in
    const checkInRes = recordCheckIn(emp.id, lat, lon);

    if (checkInRes.success) {
      setScanResult({
        status: 'success',
        action: 'CHECK_IN',
        title: 'Attendance Recorded: CHECK IN',
        message: checkInRes.message,
        empName: emp.fullName,
        empCode: emp.employeeId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      return;
    }

    // If check in returned already checked in, attempt check out
    if (checkInRes.message.includes('already checked in')) {
      const checkOutRes = recordCheckOut(emp.id, lat, lon);
      if (checkOutRes.success) {
        setScanResult({
          status: 'success',
          action: 'CHECK_OUT',
          title: 'Attendance Recorded: CHECK OUT',
          message: checkOutRes.message,
          empName: emp.fullName,
          empCode: emp.employeeId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        setScanResult({
          status: 'warning',
          title: 'Attendance Complete',
          message: checkOutRes.message,
          empName: emp.fullName,
          empCode: emp.employeeId
        });
      }
      return;
    }

    // Other errors (GPS out of range, disabled employee, etc.)
    setScanResult({
      status: 'error',
      title: 'Scan Rejected',
      message: checkInRes.message,
      empName: emp.fullName,
      empCode: emp.employeeId
    });
  };

  // Mount HTML5 QR Code Live Camera Scanner
  useEffect(() => {
    if (!isCameraActive) return;

    let html5QrcodeScanner: Html5QrcodeScanner | null = null;
    try {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        /* verbose= */ false
      );

      html5QrcodeScanner.render(
        (decodedText) => {
          handleExecuteScan(decodedText);
        },
        (errorMessage) => {
          // ignore transient scan frame errors
        }
      );

      scannerRef.current = html5QrcodeScanner;
      setCameraError(null);
    } catch (e: any) {
      console.warn("Camera init exception:", e);
      setCameraError("Camera access unavailable or blocked by browser permissions.");
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {
          // cleanup fallback
        }
      }
    };
  }, [isCameraActive]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30 mb-1">
          <QrCode className="w-3.5 h-3.5" />
          Live Kiosk Scanner Terminal
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">QR Attendance Check-In Station</h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Position your digital QR pass or employee badge in front of the device camera.
        </p>
      </div>

      {/* Main Terminal Scanner Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl text-center relative overflow-hidden">
        {/* GPS Verification Badge */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6 text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-slate-300">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Target Office: <strong>{companyWorkZone.name || settings.officeName}</strong></span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/60 rounded-xl border border-blue-800/60 text-blue-300 font-mono">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>({activeLat}, {activeLng})</span>
          </div>
        </div>

        {/* Camera Control Bar */}
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Live Camera Feed</span>
          </span>
          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 text-slate-200 cursor-pointer"
          >
            {isCameraActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Pause Camera</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Start Live Camera</span>
              </>
            )}
          </button>
        </div>

        {/* Live Camera Viewport Element */}
        <div className="relative min-h-[280px] bg-slate-950 rounded-2xl border-2 border-slate-800 overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner">
          {isCameraActive ? (
            <div id="reader" className="w-full max-w-sm rounded-xl overflow-hidden [&_video]:rounded-xl [&_select]:bg-slate-900 [&_select]:text-white [&_select]:border-slate-800 [&_button]:bg-blue-600 [&_button]:text-white [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-1 text-xs" />
          ) : (
            <div className="p-8 text-center space-y-2">
              <CameraOff className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Camera Scanner Paused</p>
              <button
                onClick={() => setIsCameraActive(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Turn On Camera
              </button>
            </div>
          )}

          {cameraError && (
            <div className="mt-3 p-3 bg-amber-950/80 border border-amber-800/80 text-amber-200 rounded-xl text-xs max-w-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 inline mr-1.5" />
              {cameraError}
            </div>
          )}
        </div>

        {/* Quick Employee Selection Manual Scan Fallback */}
        <div className="mt-8 pt-6 border-t border-slate-800 max-w-md mx-auto space-y-3">
          <label className="block text-xs font-semibold text-slate-400 text-left">
            Manual Employee QR Test Selector:
          </label>
          <div className="flex gap-2">
            <select
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none"
            >
              <option value="">Select Employee for Scan...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeId} - {emp.fullName} ({emp.designation})
                </option>
              ))}
            </select>

            <button
              disabled={!selectedEmpId}
              onClick={() => handleExecuteScan(selectedEmpId)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-900/30 shrink-0"
            >
              Scan Selected
            </button>
          </div>
        </div>
      </div>

      {/* Scan Result Feedback Banner */}
      {scanResult && (
        <div className={`p-6 rounded-3xl border shadow-xl animate-in zoom-in-95 duration-150 ${
          scanResult.status === 'success' ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' :
          scanResult.status === 'warning' ? 'bg-amber-950/80 border-amber-500/40 text-amber-200' :
          'bg-rose-950/80 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${
              scanResult.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
              scanResult.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
              'bg-rose-500/20 text-rose-400'
            }`}>
              {scanResult.status === 'success' ? <CheckCircle2 className="w-8 h-8" /> :
               scanResult.status === 'warning' ? <AlertTriangle className="w-8 h-8" /> :
               <XCircle className="w-8 h-8" />}
            </div>

            <div className="flex-1">
              <h3 className="text-base font-bold text-white">{scanResult.title}</h3>
              <p className="text-xs mt-1 font-medium text-slate-300">{scanResult.message}</p>

              {scanResult.empName && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-white">{scanResult.empName}</span> ({scanResult.empCode})
                  </div>
                  {scanResult.timestamp && (
                    <div className="font-mono font-bold bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300">
                      Timestamp: {scanResult.timestamp}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
