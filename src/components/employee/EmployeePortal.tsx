import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { animations } from '../../lib/animations';
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
  StopCircle,
  Fingerprint,
  Loader2,
  ChevronRight
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
  const { activeEmployee, attendance, recordCheckIn, recordCheckOut, settings, updateEmployee, companyWorkZone, updateAttendanceRecord, addAuditLog, logout } = useAuth();
  const { triggerHaptic } = useHaptic();

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

  const [attendanceFilter, setAttendanceFilter] = useState<'All' | 'Present' | 'Late' | 'Absent' | 'Leave'>('All');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendance.find(a => (a.employeeId === activeEmployee?.id || a.employeeCode === activeEmployee?.employeeId) && a.date === todayStr);
  const rawHistory = attendance.filter(a => a.employeeId === activeEmployee?.id || a.employeeCode === activeEmployee?.employeeId);
  const empHistory = rawHistory.filter(rec => {
    if (attendanceFilter === 'All') return true;
    if (attendanceFilter === 'Leave') return rec.status === 'On Leave' || rec.status === 'Leave';
    return rec.status === attendanceFilter;
  });

  // Break & WFH state
  const [activeBreak, setActiveBreak] = useState<{ type: 'Tea Break' | 'Lunch Break' | 'Geo-Fence Auto Break'; startAt: string } | null>(null);
  const [breakElapsedSec, setBreakElapsedSec] = useState(0);
  const [isWfh, setIsWfh] = useState(false);

  // Sync activeBreak from today's record
  useEffect(() => {
    if (todayRecord?.breaks) {
      const ongoing = todayRecord.breaks.find(b => !b.endAt);
      if (ongoing) {
        setActiveBreak({ type: ongoing.type as any, startAt: ongoing.startAt });
        return;
      }
    }
    setActiveBreak(null);
  }, [todayRecord?.breaks]);

  // Sync WFH flag from today's record
  useEffect(() => {
    setIsWfh(todayRecord?.isWfh ?? false);
  }, [todayRecord?.id, todayRecord?.isWfh]);

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

  // Auto Geo-Fence Logic
  useEffect(() => {
    // Only apply if GPS is required, they are checked in, not checked out, and not WFH
    if (!settings.gpsRequired || !todayRecord?.checkInAt || todayRecord?.checkOutAt || isWfh) return;

    // We have a verified live distance
    if (liveDistanceMeters !== null) {
      if (!isVerifiedLocation && !activeBreak) {
        // They walked out of radius, start Geo break & logout
        handleStartBreak('Geo-Fence Auto Break');
        setActionFeedback({ success: false, message: 'You left the office zone. Shift paused and auto-logging out.' });
        triggerHaptic('error');
        
        // Wait a tiny bit for the state/firebase to save, then logout
        setTimeout(() => {
          logout();
        }, 1500);
      } else if (isVerifiedLocation && activeBreak?.type === 'Geo-Fence Auto Break') {
        // They walked back into radius, end Geo break
        handleEndBreak();
      }
    }
  }, [liveDistanceMeters, isVerifiedLocation, todayRecord?.checkInAt, todayRecord?.checkOutAt, isWfh, activeBreak?.type, settings.gpsRequired]);

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
    triggerHaptic('medium');
    setIsCheckingIn(true);
    setActionFeedback(null);
    
    // Simulate loading for the animation requirement
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const res = await recordCheckIn(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    if (res.success && res.record && isWfh) {
      updateAttendanceRecord(res.record.id, { isWfh: true, status: 'Work From Home', notes: 'Self check-in — Work From Home' });
    }
    
    if (res.success) {
      triggerHaptic('success');
    } else {
      triggerHaptic('error');
    }
    
    setIsCheckingIn(false);
    setActionFeedback({ success: res.success, message: res.message });
  };

  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const handleSelfCheckOut = async () => {
    triggerHaptic('warning');
    const isFinal = window.confirm(
      "Are you sure you want to Check Out for the day?\n\n" +
      "⚠️ YOUR WORKING TIME WILL END HERE.\n" +
      "If you are just going on a break, please use the 'Tea Break' or 'Lunch Break' options instead.\n\n" +
      "Click OK to permanently end your shift today."
    );
    if (!isFinal) return;

    triggerHaptic('medium');
    setActionFeedback(null);
    // Auto-end any open break before checkout
    if (activeBreak && todayRecord) {
      const durationMinutes = Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 60000);
      const existingBreaks = todayRecord.breaks || [];
      const updatedBreaks = existingBreaks.map(b => 
        (b.startAt === activeBreak.startAt && !b.endAt) 
          ? { ...b, endAt: new Date().toISOString(), durationMinutes } 
          : b
      );
      updateAttendanceRecord(todayRecord.id, { breaks: updatedBreaks, totalBreakMinutes: (todayRecord.totalBreakMinutes || 0) + durationMinutes });
    }
    const res = await recordCheckOut(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    
    if (res.success) triggerHaptic('success');
    else triggerHaptic('error');
    
    setActionFeedback({ success: res.success, message: res.message });
  };

  const handleStartBreak = (type: 'Tea Break' | 'Lunch Break' | 'Geo-Fence Auto Break') => {
    triggerHaptic('medium');
    if (!todayRecord || activeBreak) return;

    const startAt = new Date().toISOString();
    const newBreak: BreakEntry = { type, startAt, endAt: null, durationMinutes: 0 };
    const existingBreaks = todayRecord.breaks || [];
    updateAttendanceRecord(todayRecord.id, { breaks: [...existingBreaks, newBreak] });
    
    if (activeEmployee) {
      addAuditLog('ATTENDANCE_BREAK_START', todayRecord.id, `${activeEmployee.fullName} started a ${type}.`);
    }
    
    if (type !== 'Geo-Fence Auto Break') {
      setActionFeedback({ success: true, message: `${type} started. Remember to end it when you return! ☕` });
    }
  };

  const handleEndBreak = () => {
    if (!activeBreak || !todayRecord) return;
    const endAt = new Date().toISOString();
    const durationMinutes = Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 60000);
    
    const existingBreaks = todayRecord.breaks || [];
    const updatedBreaks = existingBreaks.map(b => 
      (b.startAt === activeBreak.startAt && !b.endAt) 
        ? { ...b, endAt, durationMinutes } 
        : b
    );

    updateAttendanceRecord(todayRecord.id, { 
      breaks: updatedBreaks, 
      totalBreakMinutes: (todayRecord.totalBreakMinutes || 0) + durationMinutes 
    });
    
    if (activeEmployee) {
      addAuditLog('ATTENDANCE_BREAK_END', todayRecord.id, `${activeEmployee.fullName} ended their ${activeBreak.type} after ${durationMinutes} minutes.`);
    }

    if (activeBreak.type !== 'Geo-Fence Auto Break') {
      setActionFeedback({ success: true, message: `${activeBreak.type} ended — ${durationMinutes}m recorded. Welcome back! 👋` });
    } else {
      setActionFeedback({ success: true, message: `Welcome back to the office! Shift resumed. Auto-paused for ${durationMinutes}m.` });
    }
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
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImageBase64 } = await import('../../lib/imageUtils');
        const compressedBase64 = await compressImageBase64(file, 400, 400, 0.7);
        setProfilePhoto(compressedBase64);
      } catch (err) {
        console.error('Image compression failed:', err);
        // Fallback to FileReader if compression fails
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setProfilePhoto(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
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
      
      {/* Global Profile Header - Unified Obsidian Theme */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-[var(--bg-elevated)] text-[var(--text-primary)] p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] shadow-[var(--shadow-md)] backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 ${animations.stagger.container}`}
      >
        <div className={`flex items-center gap-5 text-center md:text-left ${animations.stagger.item(1)}`}>
          <div className="relative group">
            <img
              src={activeEmployee.profilePhotoUrl || profilePhoto}
              alt={activeEmployee.fullName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[var(--border-strong)] shadow-lg shadow-blue-500/10"
            />
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('emp_profile'); }}
              className={`absolute -bottom-2 -right-2 p-1.5 bg-[var(--accent-blue)] text-white rounded-xl shadow-md cursor-pointer outline-none ${animations.tap}`}
              title="Edit Profile Photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] px-2.5 py-0.5 rounded-lg border border-[var(--accent-blue)]/20">
                {activeEmployee.employeeId}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-semibold bg-[var(--bg-secondary)] px-2.5 py-0.5 rounded-lg border border-[var(--border-subtle)]">
                {activeEmployee.department}
              </span>
              <span className="text-xs text-[var(--accent-emerald)] font-semibold bg-[var(--accent-emerald)]/10 px-2 py-0.5 rounded-lg border border-[var(--accent-emerald)]/20">
                {activeEmployee.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{activeEmployee.fullName}</h1>
            <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">{activeEmployee.designation} • {settings.companyName}</p>
          </div>
        </div>

        {/* Current Status Pill */}
        <div className={`bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-subtle)] w-full md:w-auto text-center md:text-right ${animations.stagger.item(2)}`}>
          <div className="text-xs text-[var(--text-tertiary)] font-medium flex flex-col items-center justify-center md:items-end gap-1">
            <span className="uppercase tracking-wider font-semibold text-[10px]">Today's Status</span>
            <strong className={`font-bold px-3 py-1 rounded-lg border text-sm ${
              todayRecord?.isWfh
                ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                : 'text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/10 border-[var(--accent-emerald)]/20'
            }`}>
              {todayRecord?.status || 'Not Checked In'}
              {todayRecord?.isWfh && ' 🏠'}
            </strong>
          </div>
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
        <div className={`space-y-6 ${animations.stagger.container}`}>
          
          {/* Section 1: Hero & Command Center */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Personalized Command Center */}
            <div className={`bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-subtle)] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-[var(--shadow-sm)] ${animations.stagger.item(1)}`}>
              <div className="absolute inset-0 bg-[var(--gradient-card)] opacity-30"></div>
              
              <div className="relative z-10 space-y-8 flex flex-col items-center">
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--accent-blue)] tracking-wider uppercase mb-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {getGreeting()}, {displayName}
                  </h1>
                </div>

                {/* Hero Check-In Button */}
                <div className="flex flex-col items-center justify-center py-6 w-full relative">
                  {!todayRecord?.checkInAt ? (
                    <button 
                      onClick={handleSelfCheckIn} 
                      disabled={isCheckingIn}
                      className={`relative flex flex-col items-center justify-center w-[180px] h-[180px] rounded-full border-[3px] transition-all cursor-pointer outline-none ${
                        isCheckingIn 
                          ? 'border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--accent-blue)] animate-pulse'
                          : 'border-[var(--accent-blue)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-[var(--shadow-glow-blue)]'
                      } ${!isCheckingIn && animations.tap}`}
                    >
                      <div className="absolute inset-1 rounded-full border border-[var(--border-subtle)] opacity-50 pointer-events-none" />
                      
                      {isCheckingIn ? (
                        <>
                          <Loader2 className="w-10 h-10 mb-2 animate-spin text-[var(--accent-blue)]" />
                          <span className="font-semibold text-sm">Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-12 h-12 mb-3 text-[var(--accent-blue)]" strokeWidth={1.5} />
                          <span className="font-bold text-sm tracking-wide">Tap to Check In</span>
                          <span className="text-[10px] text-[var(--text-tertiary)] mt-1">Ready</span>
                        </>
                      )}
                    </button>
                  ) : !todayRecord?.checkOutAt ? (
                    <button 
                      onClick={handleSelfCheckOut}
                      className={`relative flex flex-col items-center justify-center w-[180px] h-[180px] rounded-full border-[3px] border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] shadow-[var(--shadow-glow-emerald)] transition-all cursor-pointer outline-none ${animations.tap}`}
                    >
                      <div className="absolute inset-0 bg-[var(--gradient-success)] opacity-10 rounded-full" />
                      <CheckCircle2 className="w-12 h-12 mb-3" strokeWidth={2} />
                      <span className="font-bold text-sm tracking-wide">Checked In</span>
                      <span className="text-[10px] font-mono mt-1 opacity-80">
                        {new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  ) : (
                    <div className="relative flex flex-col items-center justify-center w-[180px] h-[180px] rounded-full border-[3px] border-[var(--border-medium)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                      <LogOut className="w-10 h-10 mb-2 opacity-50" />
                      <span className="font-bold text-sm tracking-wide">Shift Complete</span>
                    </div>
                  )}
                  
                  {/* Break Actions (if checked in) */}
                  {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
                    <div className="absolute bottom-[-10px] flex gap-2">
                       {activeBreak ? (
                         <button onClick={handleEndBreak} className={`px-4 py-1.5 rounded-full bg-[var(--accent-amber)] text-amber-950 font-bold text-xs shadow-lg ${animations.tap}`}>
                           End Break ({String(Math.floor(breakElapsedSec / 60)).padStart(2, '0')}:{String(breakElapsedSec % 60).padStart(2, '0')})
                         </button>
                       ) : (
                         <>
                           <button onClick={() => handleStartBreak('Tea Break')} className={`px-4 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-xs shadow-md ${animations.tap}`}>
                             🍵 Tea
                           </button>
                           <button onClick={() => handleStartBreak('Lunch Break')} className={`px-4 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-xs shadow-md ${animations.tap}`}>
                             🍽️ Lunch
                           </button>
                         </>
                       )}
                    </div>
                  )}
                </div>

                {/* GPS Verification Status */}
                {settings.gpsRequired && !todayRecord?.checkInAt && (
                   <div className={`text-xs px-4 py-2 rounded-full border flex items-center justify-center gap-2 font-medium transition-all ${
                     gpsError ? 'bg-[var(--accent-rose)]/10 border-[var(--accent-rose)]/20 text-[var(--accent-rose)]' :
                     !gpsLocation ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/20 text-[var(--accent-blue)] animate-pulse' :
                     isVerifiedLocation ? 'bg-[var(--accent-emerald)]/10 border-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]' :
                     'bg-[var(--accent-amber)]/10 border-[var(--accent-amber)]/20 text-[var(--accent-amber)]'
                   }`}>
                     {gpsError ? (
                       <><AlertTriangle className="w-3.5 h-3.5" /> {gpsError}</>
                     ) : !gpsLocation ? (
                       <><Clock className="w-3.5 h-3.5" /> Acquiring GPS...</>
                     ) : (
                       <>
                         {isVerifiedLocation ? <MapPin className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                         {liveDistanceMeters}m from office zone
                       </>
                     )}
                   </div>
                )}
                
                {/* WFH Toggle */}
                {settings.wfhEnabled && todayRecord?.checkInAt && !todayRecord?.checkOutAt && !activeBreak && (
                  <button
                    onClick={handleToggleWfh}
                    className={`w-full max-w-[240px] py-2 rounded-xl text-xs font-semibold transition-all border ${
                      !(activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0])
                        ? 'bg-transparent border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed'
                        : isWfh
                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                          : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-sky-500/30'
                    } ${animations.tap}`}
                  >
                    {!(activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0])
                      ? '🔒 WFH Locked (Requires Approval)'
                      : isWfh 
                        ? '🏠 Working From Home' 
                        : 'Switch to WFH'}
                  </button>
                )}
              </div>
            </div>

            {/* Right: Premium Hero Image */}
            <div className={`rounded-2xl border border-[var(--border-subtle)] overflow-hidden relative h-[360px] lg:h-auto shadow-[var(--shadow-md)] ${animations.stagger.item(2)}`}>
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
        <div className="bg-[var(--bg-secondary)] min-h-[500px] flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--accent-blue)]" />
              History
            </h2>
            <span className="text-xs text-[var(--text-tertiary)] font-mono">{empHistory.length} Records</span>
          </div>

          {/* Filter Chips */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {['All', 'Present', 'Late', 'Absent', 'Leave'].map(filter => (
              <button
                key={filter}
                onClick={() => {
                  triggerHaptic();
                  setAttendanceFilter(filter as any);
                }}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                  attendanceFilter === filter 
                    ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)] shadow-[var(--shadow-glow-blue)]' 
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          
          {/* Animated List View */}
          <motion.div 
            className="flex flex-col space-y-3"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.05 } }
            }}
          >
            {empHistory.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Calendar className="w-12 h-12 text-[var(--text-muted)] mb-3" />
                <h3 className="text-[var(--text-primary)] font-semibold text-sm">No records found</h3>
                <p className="text-[var(--text-tertiary)] text-xs mt-1">Check back after you've checked in, or try a different filter.</p>
              </div>
            ) : (
              empHistory.map((rec) => {
                const statusColorMap = {
                  'Present': 'var(--accent-emerald)',
                  'Late': 'var(--accent-amber)',
                  'Absent': 'var(--accent-rose)',
                  'On Leave': 'var(--accent-violet)',
                  'Leave': 'var(--accent-violet)',
                };
                const statusColor = (statusColorMap as any)[rec.status] || 'var(--text-muted)';

                return (
                  <motion.div
                    key={rec.id}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    className="relative overflow-hidden group"
                  >
                    {/* Background swipe action hints */}
                    <div className="absolute inset-0 rounded-2xl flex items-center justify-between px-4 text-white text-xs font-bold -z-10">
                      <div className="flex items-center gap-2 text-[var(--accent-amber)]"><Edit className="w-4 h-4" /> Correction</div>
                      <div className="flex items-center gap-2 text-[var(--accent-blue)]">Details <ChevronRight className="w-4 h-4" /></div>
                    </div>

                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -80, right: 80 }}
                      dragElastic={0.1}
                      onDragEnd={(e, info) => {
                        if (info.offset.x > 50) {
                          triggerHaptic();
                          // Swipe right -> Request Correction (mock)
                          setActionFeedback({ success: true, message: "Correction request opened" });
                          setTimeout(() => setActionFeedback(null), 2000);
                        } else if (info.offset.x < -50) {
                          triggerHaptic();
                          // Swipe left -> View Details (mock)
                          setActionFeedback({ success: true, message: "Viewing detailed log" });
                          setTimeout(() => setActionFeedback(null), 2000);
                        }
                      }}
                      className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-[var(--shadow-sm)] flex items-center justify-between z-10 bg-[var(--bg-tertiary)]"
                      style={{ background: 'var(--bg-tertiary)' }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Date Cube */}
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0">
                          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className="text-lg font-black text-[var(--text-primary)] leading-none mt-0.5">{new Date(rec.date).getDate()}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: statusColor, boxShadow: `0 0 10px ${statusColor}80` }}
                            />
                            <span className="text-sm font-bold text-[var(--text-primary)]">{rec.status}</span>
                            {rec.isWfh && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]">WFH</span>}
                          </div>
                          
                          <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-mono mt-1">
                            <div className="flex items-center gap-1">
                              <Timer className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                              {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                              {' - '}
                              {rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-[var(--text-primary)] tabular-nums">
                          {rec.workingMinutes ? `${Math.floor(rec.workingMinutes/60)}h ${rec.workingMinutes%60}m` : '--'}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] mt-1 flex items-center justify-end gap-1">
                          {rec.locationVerified ? <MapPin className="w-3 h-3 text-[var(--accent-emerald)]" /> : null}
                          {rec.locationVerified ? 'Verified' : 'Unverified'}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
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
