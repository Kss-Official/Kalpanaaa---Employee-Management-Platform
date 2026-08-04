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
import Barcode from 'react-barcode';
import { generateEmployeeQrToken, calculateGpsDistanceMeters } from '../../lib/attendanceEngine';
import { downloadElementAsPdf } from '../../lib/pdfGenerator';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { EmployeeLeaveTab } from './EmployeeLeaveTab';
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
  const { activeEmployee, attendance, recordCheckIn, recordCheckOut, settings, updateEmployee, companyWorkZone, updateAttendanceRecord, addAuditLog } = useAuth();

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
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Profile Edit State
  const [profilePhoto, setProfilePhoto] = useState(activeEmployee?.profilePhotoUrl || AVATAR_PRESETS[0]);
  const [fullName, setFullName] = useState(activeEmployee?.fullName || '');
  const [phone, setPhone] = useState(activeEmployee?.phone || '');
  const [gender, setGender] = useState(activeEmployee?.gender || 'Prefer not to say');
  const [dateOfBirth, setDateOfBirth] = useState(activeEmployee?.dateOfBirth || '');
  const [permanentAddress, setPermanentAddress] = useState(activeEmployee?.permanentAddress || '');
  const [currentAddress, setCurrentAddress] = useState(activeEmployee?.currentAddress || '');
  const [city, setCity] = useState(activeEmployee?.city || '');
  const [state, setState] = useState(activeEmployee?.state || '');
  const [postalCode, setPostalCode] = useState(activeEmployee?.postalCode || '');
  const [emergencyContact, setEmergencyContact] = useState(activeEmployee?.emergencyContact || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(activeEmployee?.emergencyRelationship || '');
  const [bio, setBio] = useState(activeEmployee?.bio || 'Dedicated software & operations engineering professional at Kalpanaaa HRMS.');
  const [skills, setSkills] = useState<string[]>(activeEmployee?.skills || ['React', 'TypeScript', 'HR Management', 'Project Coordination']);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [preferredShift, setPreferredShift] = useState(activeEmployee?.preferredShift || activeEmployee?.shift || 'General Shift (09:00 - 18:00)');
  const [linkedinUrl, setLinkedinUrl] = useState(activeEmployee?.linkedinUrl || 'https://linkedin.com/in/employee');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
      setPermanentAddress(activeEmployee.permanentAddress || '');
      setCurrentAddress(activeEmployee.currentAddress || '');
      setCity(activeEmployee.city);
      setState(activeEmployee.state);
      setPostalCode(activeEmployee.postalCode);
      setEmergencyContact(activeEmployee.emergencyContact);
      setEmergencyRelationship(activeEmployee.emergencyRelationship);
      setBio(activeEmployee.bio || 'Dedicated software & operations engineering professional.');
      setSkills(activeEmployee.skills || []);
      setPreferredShift(activeEmployee.preferredShift || activeEmployee.shift);
      setLinkedinUrl(activeEmployee.linkedinUrl || '');
    }
  }, [activeEmployee]);

  // Acquire Geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGpsLocation({ 
            lat: pos.coords.latitude, 
            lon: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy) || 8
          });
          setGpsError(null);
        },
        err => {
          console.warn('Employee location prompt:', err.message);
          setGpsError(err.message || 'Location access denied or unavailable.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGpsError('Geolocation is not supported by your browser.');
    }
  }, []);

  const liveDistanceMeters = (gpsLocation && companyWorkZone)
    ? calculateGpsDistanceMeters(gpsLocation.lat, gpsLocation.lon, companyWorkZone.latitude, companyWorkZone.longitude)
    : null;

  const isVerifiedLocation = liveDistanceMeters !== null
    ? liveDistanceMeters <= companyWorkZone.radiusMeters
    : false;

  // Generate Static QR Code for ID Card (Company Website)
  useEffect(() => {
    if (activeEmployee) {
      const payload = 'https://www.kalpanaaasoftwaresolutions.in/';
      QRCode.toDataURL(payload, { 
        width: 320, 
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (err, url) => {
        if (!err && url) setQrUrl(url);
      });
    }
  }, [activeEmployee]);

  if (!activeEmployee) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium bg-slate-900 rounded-3xl border border-slate-800">
        No active employee profile associated with this account. Please select a role in the top bar or contact HR.
      </div>
    );
  }

  const handleSelfCheckIn = async () => {
    setActionFeedback(null);
    const res = await recordCheckIn(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    if (res.success && res.record && isWfh) {
      updateAttendanceRecord(res.record.id, { isWfh: true, status: 'Work From Home', notes: 'Self check-in — Work From Home' });
    }
    setActionFeedback({ success: res.success, message: res.message });
  };

  const handleSelfCheckOut = async () => {
    const isFinal = window.confirm(
      "Are you sure you want to Check Out for the day?\n\n" +
      "⚠️ YOUR WORKING TIME WILL END HERE.\n" +
      "If you are just going on a break, please use the 'Tea Break' or 'Lunch Break' options instead.\n\n" +
      "Click OK to permanently end your shift today."
    );
    if (!isFinal) return;

    setActionFeedback(null);
    // Auto-end any open break before checkout
    if (activeBreak && todayRecord) {
      const durationMinutes = Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 60000);
      const completedBreak: BreakEntry = { type: activeBreak.type, startAt: activeBreak.startAt, endAt: new Date().toISOString(), durationMinutes };
      const existingBreaks = todayRecord.breaks || [];
      updateAttendanceRecord(todayRecord.id, { breaks: [...existingBreaks, completedBreak], totalBreakMinutes: (todayRecord.totalBreakMinutes || 0) + durationMinutes });
      setActiveBreak(null);
    }
    const res = await recordCheckOut(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    setActionFeedback({ success: res.success, message: res.message });
  };

  const handleStartBreak = (type: 'Tea Break' | 'Lunch Break') => {
    if (!todayRecord || activeBreak) return;
    const startAt = new Date().toISOString();
    setActiveBreak({ type, startAt });
    setBreakElapsedSec(0);
    
    if (activeEmployee) {
      addAuditLog('ATTENDANCE_BREAK_START', todayRecord.id, `${activeEmployee.fullName} started a ${type}.`);
    }
    
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
    
    if (activeEmployee) {
      addAuditLog('ATTENDANCE_BREAK_END', todayRecord.id, `${activeEmployee.fullName} ended their ${activeBreak.type} after ${durationMinutes} minutes.`);
    }

    setActionFeedback({ success: true, message: `${completedBreak.type} ended — ${durationMinutes}m recorded. Welcome back! 👋` });
  };

  const handleToggleWfh = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const approvedDates = activeEmployee.approvedWfhDates || [];
    
    if (!approvedDates.includes(todayStr)) {
      setActionFeedback({ success: false, message: 'Work From Home requires prior approval. Please submit a request in the "My Leave & WFH" tab.' });
      return;
    }

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
    setIsSaving(true);
    updateEmployee(activeEmployee.id, {
      fullName,
      phone,
      gender: gender as any,
      dateOfBirth,
      profilePhotoUrl: profilePhoto,
      permanentAddress,
      currentAddress,
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
    setIsSaving(false);
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
                className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-xs rounded-xl cursor-pointer transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Check In Now</span>
              </button>
            ) : !todayRecord?.checkOutAt ? (
              <button
                onClick={handleSelfCheckOut}
                className="w-full md:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-xs rounded-xl cursor-pointer transition-all shadow-lg shadow-rose-900/40 hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Check Out Now</span>
              </button>
            ) : (
              <span className="w-full md:w-auto text-center px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700">
                ✓ Attendance Completed
              </span>
            )}
          </div>

          {/* WFH Toggle — visible when checked in but not yet checked out */}
          {settings.wfhEnabled && todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
            <button
              onClick={handleToggleWfh}
              className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                !(activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0])
                  ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-75'
                  : isWfh
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-sky-300 hover:border-sky-500/40'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              {!(activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0])
                ? '🔒 WFH Locked (Requires Admin Approval)'
                : isWfh 
                  ? '🏠 WFH Active — Click to Switch to Office' 
                  : 'Mark as Work From Home Today'}
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
          
          {/* Section 1: Hero & Command Center */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Personalized Command Center */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900/0 to-slate-900/0 opacity-50"></div>
              
              <div className="relative z-10 space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
                    {getGreeting()}, {displayName}
                  </h1>
                  <p className="text-sm text-slate-400 font-medium">
                    {activeEmployee.designation} <span className="mx-2 text-slate-600">•</span> {settings.companyName}
                  </p>
                </div>

                {/* Primary Actions (Check-In / Out) */}
                <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Current Status</span>
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${
                      activeBreak ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20' :
                      todayRecord?.isWfh
                        ? 'text-sky-400 bg-sky-400/10 border border-sky-400/20'
                        : 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20'
                    }`}>
                      {activeBreak ? `On ${activeBreak.type}` : todayRecord?.status || 'Not Checked In'} {todayRecord?.isWfh && !activeBreak && ' (WFH)'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {!todayRecord?.checkInAt ? (
                      <div className="flex flex-col gap-2">
                        {settings.gpsRequired && (
                          <div className={`text-xs p-2.5 rounded-lg border flex items-center justify-center gap-2 font-medium ${
                            gpsError ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            !gpsLocation ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' :
                            isVerifiedLocation ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {gpsError ? (
                              <><AlertTriangle className="w-4 h-4" /> {gpsError}</>
                            ) : !gpsLocation ? (
                              <><Clock className="w-4 h-4" /> Acquiring GPS...</>
                            ) : (
                              <>
                                {isVerifiedLocation ? <CheckCircle2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                {liveDistanceMeters}m from office (Limit: {companyWorkZone.radiusMeters}m)
                              </>
                            )}
                          </div>
                        )}
                        <button 
                          onClick={handleSelfCheckIn} 
                          disabled={settings.gpsRequired && (!isVerifiedLocation || !gpsLocation)}
                          className={`w-full px-4 py-3 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm ${
                            settings.gpsRequired && (!isVerifiedLocation || !gpsLocation)
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                              : 'bg-white hover:bg-slate-100 text-slate-900'
                          }`}>
                          <Clock className="w-4 h-4" /> Check In
                        </button>
                      </div>
                    ) : !todayRecord?.checkOutAt ? (
                      <>
                        {activeBreak ? (
                          <div className="flex flex-col gap-3">
                            <button onClick={handleEndBreak} className="w-full px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/50 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm animate-pulse">
                              <StopCircle className="w-5 h-5" /> End Break ({String(Math.floor(breakElapsedSec / 60)).padStart(2, '0')}:{String(breakElapsedSec % 60).padStart(2, '0')})
                            </button>
                            <button 
                              onClick={handleSelfCheckOut} 
                              disabled={settings.gpsRequired && (!isVerifiedLocation || !gpsLocation)}
                              className={`w-full px-4 py-2 font-semibold text-xs rounded-lg transition-colors border flex items-center justify-center gap-2 ${
                                settings.gpsRequired && (!isVerifiedLocation || !gpsLocation)
                                  ? 'bg-transparent text-slate-600 border-transparent cursor-not-allowed'
                                  : 'bg-transparent text-slate-500 hover:text-red-400 border-transparent hover:border-red-400/30'
                              }`}>
                              <LogOut className="w-3.5 h-3.5" /> Force Check Out {settings.gpsRequired && (!isVerifiedLocation || !gpsLocation) && '(Out of Range)'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleStartBreak('Tea Break')} className="flex-1 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition-colors border border-slate-700 flex flex-col items-center justify-center gap-1.5">
                                <Coffee className="w-4 h-4 text-amber-400" /> Tea Break
                              </button>
                              <button onClick={() => handleStartBreak('Lunch Break')} className="flex-1 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition-colors border border-slate-700 flex flex-col items-center justify-center gap-1.5">
                                <UtensilsCrossed className="w-4 h-4 text-orange-400" /> Lunch Break
                              </button>
                            </div>
                            
                            {settings.gpsRequired && (
                              <div className={`text-xs p-2.5 rounded-lg border flex items-center justify-center gap-2 font-medium ${
                                gpsError ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                !gpsLocation ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' :
                                isVerifiedLocation ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              }`}>
                                {gpsError ? (
                                  <><AlertTriangle className="w-4 h-4" /> {gpsError}</>
                                ) : !gpsLocation ? (
                                  <><Clock className="w-4 h-4" /> Acquiring GPS...</>
                                ) : (
                                  <>
                                    {isVerifiedLocation ? <CheckCircle2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                    {liveDistanceMeters}m from office (Limit: {companyWorkZone.radiusMeters}m)
                                  </>
                                )}
                              </div>
                            )}

                            <button 
                              onClick={handleSelfCheckOut} 
                              disabled={settings.gpsRequired && (!isVerifiedLocation || !gpsLocation)}
                              className={`w-full px-4 py-3 font-bold text-sm rounded-lg transition-colors border flex items-center justify-center gap-2 shadow-sm ${
                                settings.gpsRequired && (!isVerifiedLocation || !gpsLocation)
                                  ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                                  : 'bg-slate-800 hover:bg-red-500/20 text-white hover:text-red-400 border-slate-700 hover:border-red-500/50'
                              }`}>
                              <LogOut className="w-4 h-4" /> Check Out
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full px-4 py-3 bg-slate-900 text-slate-500 font-bold text-sm rounded-lg border border-slate-800 text-center">
                        ✓ Shift Completed
                      </div>
                    )}
                  </div>

                  {settings.wfhEnabled && todayRecord?.checkInAt && !todayRecord?.checkOutAt && !activeBreak && (
                    <button
                      onClick={handleToggleWfh}
                      className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        !(activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0])
                          ? 'bg-transparent border-slate-800 text-slate-500 cursor-not-allowed'
                          : isWfh
                            ? 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20'
                            : 'bg-transparent border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      {!(activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0])
                        ? '🔒 WFH Locked (Requires Admin Approval)'
                        : isWfh 
                          ? 'Working From Home' 
                          : 'Switch to WFH'}
                    </button>
                  )}
                </div>

                {/* Micro Attendance Summary */}
                <div className="flex items-center gap-6 pt-2">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Check-In</span>
                    <span className="text-sm font-mono text-white">
                      {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Hours Logged</span>
                    <span className="text-sm font-mono text-white">
                      {todayRecord?.workingMinutes ? `${Math.floor(todayRecord.workingMinutes/60)}h ${todayRecord.workingMinutes%60}m` : '0h 0m'}
                    </span>
                  </div>
                  {todayRecord?.totalBreakMinutes !== undefined && todayRecord.totalBreakMinutes > 0 && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Break Time</span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {Math.floor(todayRecord.totalBreakMinutes/60)}h {todayRecord.totalBreakMinutes%60}m
                      </span>
                    </div>
                  )}
                  {isVerifiedLocation !== null && !todayRecord?.isWfh && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Location</span>
                      <span className={`text-xs font-bold flex items-center gap-1 ${isVerifiedLocation ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isVerifiedLocation ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {isVerifiedLocation ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Premium Hero Image */}
            <div className="rounded-2xl border border-slate-800/80 overflow-hidden relative h-[360px] lg:h-auto shadow-sm">
              <img 
                src="/elite_engineering_team.png" 
                alt="Kalpanaaa Engineering Team" 
                className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-1000 hover:scale-105"
              />
              
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-white font-semibold text-lg tracking-tight mb-2">Building the future of enterprise software.</p>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> System Operational</span>
                  <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-400" /> Core Services Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Productivity & Workflow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Current Tasks */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-500" /> Current Tasks
              </h3>
              <div className="space-y-3">
                {[
                  { title: "Review PR #4812 - Core API Optimization", project: "Infrastructure", status: "In Progress" },
                  { title: "Design System Architecture Document", project: "Platform", status: "To Do" },
                  { title: "Q3 Roadmap Planning Sync", project: "Management", status: "Completed" }
                ].map((task, i) => (
                  <div key={i} className="flex items-start justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/40 hover:border-slate-700 transition-colors cursor-default">
                    <div>
                      <p className="text-sm font-medium text-white mb-0.5">{task.title}</p>
                      <span className="text-[10px] font-mono text-slate-500">{task.project}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      task.status === 'Completed' ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' :
                      task.status === 'In Progress' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                      'text-slate-400 border-slate-700 bg-slate-800'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Balance & Performance Summary */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" /> Leave Balance & Summary
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/40">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Annual Leave</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white leading-none">14</span>
                    <span className="text-xs text-slate-400 font-medium pb-0.5">/ 21 days</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '66%' }}></div>
                  </div>
                </div>
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/40">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Sick Leave</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white leading-none">5</span>
                    <span className="text-xs text-slate-400 font-medium pb-0.5">/ 7 days</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '71%' }}></div>
                  </div>
                </div>
              </div>

              {/* Performance Mini-Stat */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Performance Score</p>
                    <p className="text-[10px] text-slate-500">Based on Q2 Reviews</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-white font-mono">4.8<span className="text-slate-500 text-xs">/5</span></span>
              </div>
            </div>
          </div>

          {/* Section 3: Culture & Communication */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Announcements */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" /> Company Announcements
              </h3>
              <div className="space-y-4">
                {[
                  { title: "Q3 Engineering All-Hands", date: "Today", desc: "Join us at 4 PM for product roadmap updates and architecture review." },
                  { title: "New Security Policies", date: "Yesterday", desc: "Please review the updated device fingerprinting and concurrent login policies." },
                ].map((news, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-slate-800">
                    <div className="absolute w-2 h-2 rounded-full bg-blue-500 -left-[5px] top-1.5"></div>
                    <p className="text-sm font-bold text-white mb-0.5">{news.title}</p>
                    <p className="text-xs text-slate-400 mb-1">{news.desc}</p>
                    <span className="text-[10px] font-mono text-slate-500">{news.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notifications / Calendar */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" /> Today's Agenda
              </h3>
              <div className="space-y-3">
                {[
                  { time: "10:00 AM", title: "Daily Engineering Standup", type: "meeting" },
                  { time: "01:30 PM", title: "Architecture Review: Payment Gateway", type: "meeting" },
                  { time: "04:00 PM", title: "Q3 Engineering All-Hands", type: "event" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800/40">
                    <div className="text-center min-w-[60px]">
                      <span className="block text-[10px] font-mono text-slate-400">{item.time.split(' ')[0]}</span>
                      <span className="block text-[9px] font-bold text-slate-500">{item.time.split(' ')[1]}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-800"></div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">{item.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Break Management - Condensed & Minimal */}
          {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Break Management</h4>
                  <p className="text-[11px] text-slate-400">Total break time today: <span className="font-mono text-slate-300">{todayRecord?.totalBreakMinutes || 0}m</span></p>
                </div>
              </div>

              {activeBreak ? (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider">{activeBreak.type} Active</span>
                    <span className="text-lg font-mono font-bold text-white">{formatBreakTime(breakElapsedSec)}</span>
                  </div>
                  <button onClick={handleEndBreak} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-lg transition-colors flex items-center gap-2">
                    <StopCircle className="w-4 h-4" /> End Break
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => handleStartBreak('Tea Break')} className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors flex items-center gap-2">
                    <Coffee className="w-3.5 h-3.5" /> Tea Break
                  </button>
                  <button onClick={() => handleStartBreak('Lunch Break')} className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors flex items-center gap-2">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Lunch Break
                  </button>
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

      {/* 3. PRINTABLE ID CARD TAB */}
      {activeTab === 'emp_qr' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-8 shadow-2xl max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                Employee ID Card Generator
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">Print your official corporate ID card or download it as a PDF.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-slate-950/50 p-8 rounded-2xl border border-slate-800/60 overflow-x-auto">
            
            {/* The Print Container */}
            <div id="employee-id-card-element" className="flex flex-col sm:flex-row gap-6 bg-transparent pb-8">
              
              {/* FRONT OF CARD - BARCODE */}
              <div className="w-[340px] h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex flex-col scale-[0.7] origin-top sm:scale-[0.8] md:scale-[0.85] lg:scale-100 mx-auto items-center justify-center p-8">
                <div className="w-full flex flex-col items-center justify-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scan to Verify Employee</div>
                  <div className="flex justify-center overflow-hidden w-full bg-white py-2">
                    <Barcode value={activeEmployee.employeeId} width={1.8} height={50} displayValue={false} margin={0} background="#ffffff" />
                  </div>
                  <div className="text-xl text-center text-slate-800 font-black tracking-[0.2em]">{activeEmployee.employeeId}</div>
                  <div className="text-sm text-center text-slate-500 font-bold uppercase tracking-widest border-t border-slate-200 pt-3 w-full">{activeEmployee.fullName}</div>
                </div>
              </div>

              {/* BACK OF CARD - QR ONLY */}
              <div className="w-[340px] h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex flex-col scale-[0.7] origin-top sm:scale-[0.8] md:scale-[0.85] lg:scale-100 mx-auto items-center justify-center p-8">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Website QR Code" className="w-64 h-64 object-contain image-render-crisp" />
                  ) : (
                    <div className="w-64 h-64 bg-slate-100 animate-pulse rounded-xl" />
                  )}
                </div>
                <div className="text-sm text-center text-slate-400 font-black mt-8 tracking-widest uppercase flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4" /> Company Portal
                </div>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            <button
              onClick={() => window.print()}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print (CR80 Format)</span>
            </button>

            <button
              onClick={() => downloadElementAsPdf('employee-id-card-element', `ID_Card_${activeEmployee.employeeId}.pdf`)}
              className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/40"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
          
          <p className="text-[10px] text-slate-500 text-center">
            Note: Ensure your printer settings are set to 100% scale (no margins) if printing directly to CR80 ID cards.
          </p>
        </div>
      )}

      {/* 4. MY LEAVE & WFH TAB */}
      {activeTab === 'emp_leave' && (
        <EmployeeLeaveTab />
      )}

      {/* 5. EDIT PROFILE & FACE PHOTO SETTINGS TAB */}
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
                  <label className="block text-slate-400 font-semibold mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Phone Number <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Gender <span className="text-rose-500">*</span></label>
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
                  <label className="block text-slate-400 font-semibold mb-1">Date of Birth <span className="text-rose-500">*</span></label>
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
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Permanent Address <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      value={permanentAddress}
                      onChange={e => setPermanentAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Current Address <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      value={currentAddress}
                      onChange={e => setCurrentAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">City <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">State / Postal Code <span className="text-rose-500">*</span></label>
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
                      placeholder="e.g. JavaScript, HR Operations, Figma"
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
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 shadow-md"
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
