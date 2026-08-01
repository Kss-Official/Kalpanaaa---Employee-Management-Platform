import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  CreditCard, 
  QrCode, 
  User, 
  MapPin, 
  FileText, 
  Download, 
  LogOut,
  Sparkles,
  Camera,
  Upload,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  Building2,
  Phone,
  Mail,
  Briefcase,
  Calendar,
  Globe,
  ShieldCheck,
  Zap,
  Save,
  RotateCcw,
  Printer,
  Coffee,
  UtensilsCrossed,
  Home,
  Timer,
  PlayCircle,
  StopCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { generateEmployeeQrToken, calculateGpsDistanceMeters } from '../../lib/attendanceEngine';
import { downloadElementAsPdf } from '../../lib/pdfGenerator';
import { BreakEntry } from '../../types';

interface EmployeePortalProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Curated high quality face avatar presets
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300'
];

export const EmployeePortal: React.FC<EmployeePortalProps> = ({ activeTab, setActiveTab }) => {
  const { activeEmployee, attendance, recordCheckIn, recordCheckOut, settings, updateEmployee, companyWorkZone, updateAttendanceRecord } = useAuth();

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };
  const displayName = activeEmployee?.fullName?.split(' ')[0] || 'there';

  const [qrUrl, setQrUrl] = useState<string>('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Profile Edit State
  const [profilePhoto, setProfilePhoto] = useState(activeEmployee?.profilePhotoUrl || AVATAR_PRESETS[0]);
  const [fullName, setFullName] = useState(activeEmployee?.fullName || '');
  const [phone, setPhone] = useState(activeEmployee?.phone || '');
  const [gender, setGender] = useState(activeEmployee?.gender || 'Prefer not to say');
  const [dateOfBirth, setDateOfBirth] = useState(activeEmployee?.dateOfBirth || '');
  const [address, setAddress] = useState(activeEmployee?.address || '');
  const [city, setCity] = useState(activeEmployee?.city || '');
  const [state, setState] = useState(activeEmployee?.state || '');
  const [postalCode, setPostalCode] = useState(activeEmployee?.postalCode || '');
  const [emergencyContact, setEmergencyContact] = useState(activeEmployee?.emergencyContact || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(activeEmployee?.emergencyRelationship || '');
  const [bio, setBio] = useState(activeEmployee?.bio || 'Dedicated software & operations engineering professional at Kalpana HRMS.');
  const [skills, setSkills] = useState<string[]>(activeEmployee?.skills || ['React', 'TypeScript', 'HR Management', 'Project Coordination']);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [preferredShift, setPreferredShift] = useState(activeEmployee?.preferredShift || activeEmployee?.shift || 'General Shift (09:00 - 18:00)');
  const [linkedinUrl, setLinkedinUrl] = useState(activeEmployee?.linkedinUrl || 'https://linkedin.com/in/employee');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCapturingCamera, setIsCapturingCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendance.find(a => (a.employeeId === activeEmployee?.id || a.employeeCode === activeEmployee?.employeeId) && a.date === todayStr);
  const empHistory = attendance.filter(a => a.employeeId === activeEmployee?.id || a.employeeCode === activeEmployee?.employeeId);

  // Break & WFH state
  const [activeBreak, setActiveBreak] = useState<{ type: 'Tea Break' | 'Lunch Break'; startAt: string } | null>(null);
  const [breakElapsedSec, setBreakElapsedSec] = useState(0);
  const [isWfh, setIsWfh] = useState(false);

  // Sync WFH flag from today's record
  useEffect(() => {
    setIsWfh(todayRecord?.isWfh ?? false);
  }, [todayRecord?.id]);

  // Break live timer ticker
  useEffect(() => {
    if (!activeBreak) { setBreakElapsedSec(0); return; }
    const interval = setInterval(() => {
      setBreakElapsedSec(Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  const formatBreakTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  // Sync profile state when active employee changes
  useEffect(() => {
    if (activeEmployee) {
      setProfilePhoto(activeEmployee.profilePhotoUrl || AVATAR_PRESETS[0]);
      setFullName(activeEmployee.fullName);
      setPhone(activeEmployee.phone);
      setGender(activeEmployee.gender);
      setDateOfBirth(activeEmployee.dateOfBirth);
      setAddress(activeEmployee.address);
      setCity(activeEmployee.city);
      setState(activeEmployee.state);
      setPostalCode(activeEmployee.postalCode);
      setEmergencyContact(activeEmployee.emergencyContact);
      setEmergencyRelationship(activeEmployee.emergencyRelationship);
      setBio(activeEmployee.bio || 'Dedicated software & operations engineering professional.');
      setSkills(activeEmployee.skills || ['React', 'TypeScript', 'HR Operations']);
      setPreferredShift(activeEmployee.preferredShift || activeEmployee.shift);
      setLinkedinUrl(activeEmployee.linkedinUrl || '');
    }
  }, [activeEmployee]);

  // Acquire Geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setGpsLocation({ 
          lat: pos.coords.latitude, 
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy) || 8
        }),
        err => console.warn('Employee location prompt:', err.message),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const liveDistanceMeters = (gpsLocation && companyWorkZone)
    ? calculateGpsDistanceMeters(gpsLocation.lat, gpsLocation.lon, companyWorkZone.latitude, companyWorkZone.longitude)
    : null;

  const isVerifiedLocation = liveDistanceMeters !== null
    ? liveDistanceMeters <= companyWorkZone.radiusMeters
    : false;

  // Generate QR Code Pass
  useEffect(() => {
    if (activeEmployee) {
      const payload = generateEmployeeQrToken(activeEmployee, settings.qrTokenLifetimeMinutes);
      QRCode.toDataURL(payload, { 
        width: 320, 
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (err, url) => {
        if (!err && url) setQrUrl(url);
      });
    }
  }, [activeEmployee, settings.qrTokenLifetimeMinutes]);

  if (!activeEmployee) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium bg-slate-900 rounded-3xl border border-slate-800">
        No active employee profile associated with this account. Please select a role in the top bar or contact HR.
      </div>
    );
  }

  const handleSelfCheckIn = () => {
    setActionFeedback(null);
    const res = recordCheckIn(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    if (res.success && res.record && isWfh) {
      updateAttendanceRecord(res.record.id, { isWfh: true, status: 'Work From Home', notes: 'Self check-in — Work From Home' });
    }
    setActionFeedback({ success: res.success, message: res.message });
  };

  const handleSelfCheckOut = () => {
    setActionFeedback(null);
    // Auto-end any open break before checkout
    if (activeBreak && todayRecord) {
      const durationMinutes = Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 60000);
      const completedBreak: BreakEntry = { type: activeBreak.type, startAt: activeBreak.startAt, endAt: new Date().toISOString(), durationMinutes };
      const existingBreaks = todayRecord.breaks || [];
      updateAttendanceRecord(todayRecord.id, { breaks: [...existingBreaks, completedBreak], totalBreakMinutes: (todayRecord.totalBreakMinutes || 0) + durationMinutes });
      setActiveBreak(null);
    }
    const res = recordCheckOut(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    setActionFeedback({ success: res.success, message: res.message });
  };

  const handleStartBreak = (type: 'Tea Break' | 'Lunch Break') => {
    if (!todayRecord || activeBreak) return;
    const startAt = new Date().toISOString();
    setActiveBreak({ type, startAt });
    setBreakElapsedSec(0);
    setActionFeedback({ success: true, message: `${type} started. Remember to end it when you return! ☕` });
  };

  const handleEndBreak = () => {
    if (!activeBreak || !todayRecord) return;
    const endAt = new Date().toISOString();
    const durationMinutes = Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 60000);
    const completedBreak: BreakEntry = { type: activeBreak.type, startAt: activeBreak.startAt, endAt, durationMinutes };
    const existingBreaks = todayRecord.breaks || [];
    updateAttendanceRecord(todayRecord.id, { breaks: [...existingBreaks, completedBreak], totalBreakMinutes: (todayRecord.totalBreakMinutes || 0) + durationMinutes });
    setActiveBreak(null);
    setActionFeedback({ success: true, message: `${completedBreak.type} ended — ${durationMinutes}m recorded. Welcome back! 👋` });
  };

  const handleToggleWfh = () => {
    const newVal = !isWfh;
    setIsWfh(newVal);
    if (todayRecord) {
      updateAttendanceRecord(todayRecord.id, {
        isWfh: newVal,
        status: newVal ? 'Work From Home' : 'Present',
        notes: newVal ? 'Employee marked as Work From Home' : 'Switched to office attendance'
      });
    }
    setActionFeedback({ success: true, message: newVal ? '🏠 Work From Home mode activated for today.' : '🏢 Office attendance mode restored.' });
  };

  // Handle Photo File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setProfilePhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Simulate Camera Snapshot
  const handleSimulateCameraCapture = () => {
    setIsCapturingCamera(true);
    setTimeout(() => {
      // Pick a fresh realistic avatar snapshot
      const randomAvatar = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
      setProfilePhoto(randomAvatar);
      setIsCapturingCamera(false);
      setActionFeedback({ success: true, message: 'Face capture snapshot recorded successfully!' });
    }, 1200);
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateEmployee(activeEmployee.id, {
      fullName,
      phone,
      gender: gender as any,
      dateOfBirth,
      profilePhotoUrl: profilePhoto,
      address,
      city,
      state,
      postalCode,
      emergencyContact,
      emergencyRelationship,
      bio,
      skills,
      preferredShift,
      linkedinUrl
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      
      {/* Employee Greeting Hero Banner - Unified Obsidian Theme */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/90 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-5 text-center md:text-left">
          <div className="relative group">
            <img
              src={activeEmployee.profilePhotoUrl || profilePhoto}
              alt={activeEmployee.fullName}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500/50 shadow-lg shadow-blue-500/20"
            />
            <button
              onClick={() => setActiveTab('emp_profile')}
              className="absolute -bottom-2 -right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md cursor-pointer transition-transform hover:scale-110"
              title="Edit Profile Photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-500/30">
                {activeEmployee.employeeId}
              </span>
              <span className="text-xs text-slate-400 font-semibold bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                {activeEmployee.department}
              </span>
              <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {activeEmployee.status}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">{getGreeting()}, {displayName} 👋</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{activeEmployee.designation} • {settings.companyName}</p>
          </div>
        </div>

        {/* Quick Check In / Check Out Action Card */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 w-full md:w-auto text-center md:text-right space-y-3">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-center md:justify-end gap-2">
            <span>Today's Status:</span>
            <strong className={`font-bold px-2 py-0.5 rounded-md border text-xs ${
              todayRecord?.isWfh
                ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {todayRecord?.status || 'Not Checked In'}
              {todayRecord?.isWfh && ' 🏠'}
            </strong>
          </div>

          <div className="flex items-center justify-center md:justify-end gap-2 flex-wrap">
            {!todayRecord?.checkInAt ? (
              <button
                onClick={handleSelfCheckIn}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Check In Now</span>
              </button>
            ) : !todayRecord?.checkOutAt ? (
              <button
                onClick={handleSelfCheckOut}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-lg shadow-rose-900/40 hover:scale-[1.02] flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Check Out Now</span>
              </button>
            ) : (
              <span className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700">
                ✓ Attendance Completed
              </span>
            )}
          </div>

          {/* WFH Toggle — visible when checked in but not yet checked out */}
          {settings.wfhEnabled && todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
            <button
              onClick={handleToggleWfh}
              className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                isWfh
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-sky-300 hover:border-sky-500/40'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              {isWfh ? '🏠 WFH Active — Click to Switch to Office' : 'Mark as Work From Home Today'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Action Feedback Banner */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
              actionFeedback.success 
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' 
                : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {actionFeedback.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              <span>{actionFeedback.message}</span>
            </div>
            <button 
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN VIEW TABS */}

      {/* 1. EMPLOYEE DASHBOARD TAB */}
      {activeTab === 'emp_dashboard' && (
        <div className="space-y-6">

          {/* Authoritative Location Verification Live Status Banner */}
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    Company Location Verification Status
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Automatically mapped to <strong className="text-blue-300 font-semibold">{companyWorkZone.name}</strong>
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="self-start sm:self-auto">
                {isVerifiedLocation ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verified (Inside Radius)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-extrabold rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Unverified ({liveDistanceMeters ? `${liveDistanceMeters}m away` : 'GPS Acquiring'})</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Company Work Zone</span>
                <span className="font-bold text-white truncate block">{companyWorkZone.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">Radius: {companyWorkZone.radiusMeters}m</span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Distance From Office</span>
                <span className="font-bold text-blue-400 font-mono text-sm">
                  {liveDistanceMeters !== null ? `${liveDistanceMeters} meters` : 'Calculating...'}
                </span>
                <span className="text-[10px] text-slate-500 block">Allowed: ≤ {companyWorkZone.radiusMeters}m</span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">GPS Accuracy</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  {gpsLocation?.accuracy ? `± ${gpsLocation.accuracy} meters` : 'High Precision'}
                </span>
                <span className="text-[10px] text-slate-500 block">Device Geolocation</span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Last Verification</span>
                <span className="font-bold text-slate-200 font-mono text-sm">
                  {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live Device Lock'}
                </span>
                <span className="text-[10px] text-slate-500 block">Snapshot Logged</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Today's Working Summary */}
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-blue-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Clock className="w-4 h-4" />
              Today's Attendance Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Check In Time</span>
                <span className="font-bold text-white font-mono">
                  {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Check Out Time</span>
                <span className="font-bold text-white font-mono">
                  {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Working Duration</span>
                <span className="font-bold text-blue-400 font-mono">
                  {todayRecord?.workingMinutes ? `${Math.floor(todayRecord.workingMinutes/60)}h ${todayRecord.workingMinutes%60}m` : '0h 0m'}
                </span>
              </div>

              {(todayRecord?.totalBreakMinutes ?? 0) > 0 && (
                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1"><Coffee className="w-3 h-3" /> Total Breaks</span>
                  <span className="font-bold text-amber-400 font-mono">{todayRecord!.totalBreakMinutes}m</span>
                </div>
              )}

              <div className="flex justify-between py-2">
                <span className="text-slate-400">Location Status</span>
                <span className="font-bold flex items-center gap-1">
                  {todayRecord?.isWfh ? (
                    <><Home className="w-3.5 h-3.5 text-sky-400" /><span className="text-sky-400">Work From Home</span></>
                  ) : (
                    <><MapPin className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">{settings.officeName}</span></>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick QR Pass Widget */}
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 text-center shadow-xl flex flex-col items-center justify-between">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-blue-400 mb-1 flex items-center justify-center gap-2">
                <QrCode className="w-4 h-4" />
                Digital QR Pass
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">Scan at office terminal kiosk for instant verification</p>

              <div className="bg-white p-3.5 rounded-2xl shadow-lg inline-block">
                {qrUrl ? (
                  <img src={qrUrl} alt="Employee Pass QR" className="w-36 h-36 mx-auto" />
                ) : (
                  <div className="w-36 h-36 bg-slate-100 animate-pulse rounded-xl" />
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-mono mt-3">Cryptographic Token Verified</p>
          </div>

          {/* Shift & Official Details */}
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-xs uppercase tracking-wider text-purple-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Briefcase className="w-4 h-4" />
              Work & Policy Profile
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Shift</span>
                <span className="font-semibold text-white">{activeEmployee.shift}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Work Location</span>
                <span className="font-semibold text-white">{activeEmployee.workLocation}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Reporting Manager</span>
                <span className="font-semibold text-white">{activeEmployee.reportingManager}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Official Email</span>
                <span className="font-semibold text-white truncate max-w-[160px]">{activeEmployee.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Break Management Panel ── shown only when actively checked in */}
        {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
          <div className="bg-slate-900/90 rounded-3xl border border-amber-500/25 p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Timer className="w-4 h-4" />
              Break Management
              {activeBreak && (
                <span className="ml-auto text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-3 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {activeBreak.type} — {formatBreakTime(breakElapsedSec)}
                </span>
              )}
            </h3>

            {activeBreak ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center w-full">
                  <p className="text-[11px] text-amber-300 font-semibold mb-1">Currently on {activeBreak.type}</p>
                  <p className="text-4xl font-black font-mono text-white tracking-tight">{formatBreakTime(breakElapsedSec)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Started at {new Date(activeBreak.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <button
                  onClick={handleEndBreak}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-2xl cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-900/40 hover:scale-[1.02] transition-all"
                >
                  <StopCircle className="w-4 h-4" />
                  End Break & Return to Work
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleStartBreak('Tea Break')}
                  className="flex items-center gap-3 px-5 py-4 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-500/30 hover:border-amber-500/60 text-white rounded-2xl cursor-pointer transition-all hover:scale-[1.01] group"
                >
                  <div className="p-2.5 bg-amber-500/20 rounded-xl group-hover:bg-amber-500/30 transition-colors">
                    <Coffee className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-extrabold text-sm text-white">Tea Break</p>
                    <p className="text-[11px] text-slate-400">Std: {settings.teaBreakDurationMinutes ?? 10}min — click to start timer</p>
                  </div>
                  <PlayCircle className="w-5 h-5 text-amber-400/60 ml-auto group-hover:text-amber-400 transition-colors" />
                </button>

                <button
                  onClick={() => handleStartBreak('Lunch Break')}
                  className="flex items-center gap-3 px-5 py-4 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-500/30 hover:border-orange-500/60 text-white rounded-2xl cursor-pointer transition-all hover:scale-[1.01] group"
                >
                  <div className="p-2.5 bg-orange-500/20 rounded-xl group-hover:bg-orange-500/30 transition-colors">
                    <UtensilsCrossed className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-extrabold text-sm text-white">Lunch Break</p>
                    <p className="text-[11px] text-slate-400">Std: {settings.lunchBreakDurationMinutes ?? 30}min — click to start timer</p>
                  </div>
                  <PlayCircle className="w-5 h-5 text-orange-400/60 ml-auto group-hover:text-orange-400 transition-colors" />
                </button>
              </div>
            )}

            {/* Break log for today */}
            {(todayRecord?.breaks?.length ?? 0) > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Break Log</p>
                {todayRecord!.breaks!.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800">
                    <span className="flex items-center gap-2">
                      {b.type === 'Tea Break' ? <Coffee className="w-3 h-3 text-amber-400" /> : <UtensilsCrossed className="w-3 h-3 text-orange-400" />}
                      {b.type}
                    </span>
                    <span className="font-mono text-slate-400">
                      {new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {b.endAt ? new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                    </span>
                    <span className="font-bold text-amber-400">{b.durationMinutes}m</span>
                  </div>
                ))}
                <p className="text-right text-[11px] font-bold text-amber-400">Total break time: {todayRecord!.totalBreakMinutes}m</p>
              </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* 2. ATTENDANCE HISTORY TAB */}
      {activeTab === 'emp_attendance' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              My Attendance Records ({empHistory.length})
            </h2>
            <span className="text-xs text-slate-400 font-mono">Filtered by account ID</span>
          </div>
          
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check In</th>
                  <th className="py-3 px-4">Check Out</th>
                  <th className="py-3 px-4">Working Time</th>
                  <th className="py-3 px-4">Breaks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {empHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No attendance records found yet. Perform a check in today!
                    </td>
                  </tr>
                ) : (
                  empHistory.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{rec.date}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-400 font-semibold">
                        {rec.workingMinutes ? `${Math.floor(rec.workingMinutes/60)}h ${rec.workingMinutes%60}m` : '--'}
                      </td>
                      <td className="py-3 px-4">
                        {(rec.totalBreakMinutes ?? 0) > 0 ? (
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <Coffee className="w-3 h-3" />
                            {rec.totalBreakMinutes}m
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                          rec.isWfh ? 'text-sky-400' :
                          rec.status === 'Present' ? 'text-emerald-400' :
                          rec.status === 'Late' ? 'text-amber-400' :
                          rec.status === 'Absent' ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {rec.isWfh && <Home className="w-3 h-3" />}
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {rec.isWfh ? '🏠 WFH' : rec.locationVerified ? '✓ Geofenced GPS' : 'Standard'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DIGITAL ID PASS TAB */}
      {activeTab === 'emp_qr' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-8 shadow-2xl max-w-md mx-auto text-center space-y-6">
          <div id="employee-pass-download-element" className="p-6 bg-slate-950 text-white rounded-3xl border border-slate-800 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-black text-blue-400 tracking-wider uppercase block">{settings.companyName}</span>
                <span className="text-[10px] text-slate-400 font-mono">DIGITAL ATTENDANCE PASS</span>
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ACTIVE PASS
              </span>
            </div>

            <div className="flex items-center gap-4 py-1">
              <img
                src={activeEmployee.profilePhotoUrl || profilePhoto}
                alt={activeEmployee.fullName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500/60 shadow-lg"
              />
              <div>
                <h2 className="text-base font-extrabold text-white">{activeEmployee.fullName}</h2>
                <p className="text-xs text-slate-300 font-semibold">{activeEmployee.designation}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono font-extrabold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/30">
                    ID: {activeEmployee.employeeId}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{activeEmployee.department}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 text-center shadow-inner">
              <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-blue-600" />
                <span>100% Optical Scannable Pass</span>
              </div>

              <div className="bg-white p-2 rounded-xl inline-block border border-slate-100">
                {qrUrl ? (
                  <img src={qrUrl} alt="Employee Pass" className="w-48 h-48 mx-auto object-contain image-render-crisp" />
                ) : (
                  <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-xl" />
                )}
              </div>

              <p className="text-[9px] font-mono text-slate-500 mt-2">
                CRYPTOGRAPHIC TOKEN: {activeEmployee.qrToken.substring(0, 16)}...
              </p>
            </div>

            <div className="text-[10px] text-slate-400 font-mono space-y-1 pt-1 border-t border-slate-800/80">
              <p><span className="text-slate-300 font-semibold">Campus Location:</span> {settings.officeName}</p>
              <p><span className="text-slate-300 font-semibold">Verification Rule:</span> Scan at Kiosk Check-In Station</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.print()}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Pass</span>
            </button>

            <button
              onClick={() => downloadElementAsPdf('employee-pass-download-element', `ID_Pass_${activeEmployee.employeeId}.pdf`)}
              className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.01]"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. EDIT PROFILE & FACE PHOTO SETTINGS TAB */}
      {activeTab === 'emp_profile' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl max-w-4xl mx-auto space-y-8 text-xs">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                My Profile & Face Image Settings
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Update your personal details, emergency contact numbers, skills, and face photo avatar.
              </p>
            </div>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                <Check className="w-3.5 h-3.5" /> Profile Updated!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-8">
            
            {/* SECTION A: FACE PHOTO & AVATAR EDITOR */}
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Face Photo & Profile Avatar
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group shrink-0">
                  <img
                    src={profilePhoto}
                    alt="Preview Avatar"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-blue-500/60 shadow-xl shadow-blue-500/20"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-white">
                    Preview
                  </div>
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* File Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo File</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Camera Capture Simulation */}
                    <button
                      type="button"
                      onClick={handleSimulateCameraCapture}
                      disabled={isCapturingCamera}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-slate-700"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isCapturingCamera ? 'Capturing Snapshot...' : 'Take Camera Photo'}</span>
                    </button>
                  </div>

                  {/* Preset Avatars Selection */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-2">Or Select Preset High-Res Avatar:</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {AVATAR_PRESETS.map((preset, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setProfilePhoto(preset)}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                            profilePhoto === preset ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/30' : 'border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <img src={preset} alt={`Avatar ${idx}`} className="w-10 h-10 object-cover" />
                          {profilePhoto === preset && (
                            <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white font-black" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION B: PERSONAL DETAILS */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-purple-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="w-4 h-4" />
                Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* SECTION C: ADDRESS & EMERGENCY CONTACT */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <MapPin className="w-4 h-4" />
                Address & Emergency Contact
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Street Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">State / Postal Code</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="State"
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Postal Code"
                      value={postalCode}
                      onChange={e => setPostalCode(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={e => setEmergencyContact(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Emergency Relationship</label>
                  <input
                    type="text"
                    value={emergencyRelationship}
                    onChange={e => setEmergencyRelationship(e.target.value)}
                    placeholder="e.g. Spouse, Parent, Sibling"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* SECTION D: SUMMARY, SKILLS & PREFERENCES */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Sparkles className="w-4 h-4" />
                Professional Summary & Skills
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Professional Bio / Summary</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-hidden focus:border-blue-500 transition-colors leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-2">Technical & Operational Skills</label>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {skills.map((skill, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold text-xs">
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-white cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3 h-3 text-blue-400 hover:text-rose-400" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add new skill..."
                      value={newSkillInput}
                      onChange={e => setNewSkillInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-blue-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SAVE BUTTON */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-2xl shadow-xl shadow-blue-600/30 hover:scale-[1.01] cursor-pointer flex items-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{savedSuccess ? 'Changes Saved Successfully!' : 'Save & Update Profile'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};
