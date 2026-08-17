import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toISTTimeString } from '../../lib/absoluteTime';
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
  ChevronRight,
  ChevronLeft,
  Edit,
  ScanFace,
  Lock,
  Eye,
  EyeOff,
  Key,
  Users,
  GraduationCap,
  Filter
} from 'lucide-react';
import QRCode from 'qrcode';
import Barcode from 'react-barcode';
import { generateEmployeeQrToken, calculateGpsDistanceMeters } from '../../lib/attendanceEngine';
import { downloadElementAsPdf } from '../../lib/pdfGenerator';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { EmployeeLeaveTab } from './EmployeeLeaveTab';
import { EmployeeTeamDirectory } from './EmployeeTeamDirectory';
import { EmployeePayslips } from './EmployeePayslips';
import { ConsentModal } from '../shared/ConsentModal';
import { FaceCaptureModal } from '../shared/FaceCaptureModal';
import { getEmployeeDescriptor } from '../../lib/faceRecognitionEngine';
import { BreakEntry, BreakType, normalizeBreakType } from '../../types';

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
  const { activeEmployee, attendance, leaveRequests, recordCheckIn, recordCheckOut, settings, updateEmployee, companyWorkZone, updateAttendanceRecord, addAuditLog, logout, updateCurrentEmployeePassword, companyWideWfhDates, notifications } = useAuth();
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

  // Biometric & Face Modal state
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isTestFaceModalOpen, setIsTestFaceModalOpen] = useState(false);
  const [isEnrollFaceModalOpen, setIsEnrollFaceModalOpen] = useState(false);

  // Real-time Password Update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdateMsg, setPasswordUpdateMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !newPassword.trim()) {
      setPasswordUpdateMsg({ success: false, message: 'Please enter a new password (minimum 6 characters).' });
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordUpdateMsg({ success: false, message: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordUpdateMsg({ success: false, message: 'New password and confirmation password do not match.' });
      return;
    }

    setIsUpdatingPass(true);
    setPasswordUpdateMsg(null);
    const res = await updateCurrentEmployeePassword(newPassword);
    setIsUpdatingPass(false);
    setPasswordUpdateMsg(res);

    if (res.success) {
      setNewPassword('');
      setConfirmPassword('');
      triggerHaptic('success');
      setTimeout(() => setPasswordUpdateMsg(null), 5000);
    } else {
      triggerHaptic('error');
    }
  };

  // Profile Edit State
  const [profilePhoto, setProfilePhoto] = useState(activeEmployee?.profilePhotoUrl || AVATAR_PRESETS[0]);
  const [fullName, setFullName] = useState(activeEmployee?.fullName || '');
  const [phone, setPhone] = useState(activeEmployee?.phone || '');
  const [gender, setGender] = useState(activeEmployee?.gender || 'Prefer not to say');
  const [dateOfBirth, setDateOfBirth] = useState(activeEmployee?.dateOfBirth || '');
  const [permanentAddress, setPermanentAddress] = useState(activeEmployee?.permanentAddress || '');
  const [currentAddress, setCurrentAddress] = useState(activeEmployee?.currentAddress || '');
  const [sameAsPermanentAddress, setSameAsPermanentAddress] = useState(false);

  const handleSameAsPermanentToggle = (checked: boolean) => {
    setSameAsPermanentAddress(checked);
    if (checked) {
      setCurrentAddress(permanentAddress);
    }
  };
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
  const todayRecords = attendance.filter(a => 
    (a.employeeId === activeEmployee?.id || a.employeeId === activeEmployee?.employeeId || a.employeeCode === activeEmployee?.employeeId || a.employeeCode === activeEmployee?.id) && 
    a.date === todayStr
  );
  // Prioritize record with active ongoing break, then checked-in record, then latest
  const todayRecord = todayRecords.find(r => r.breaks?.some(b => !b.endAt && !(b as any).endTime)) || 
                      todayRecords.find(r => r.checkInAt) || 
                      todayRecords[0];

  const rawHistory = attendance.filter(a => 
    a.employeeId === activeEmployee?.id || 
    a.employeeId === activeEmployee?.employeeId ||
    a.employeeCode === activeEmployee?.employeeId ||
    a.employeeCode === activeEmployee?.id ||
    (a.employeeName && activeEmployee?.fullName && a.employeeName.toLowerCase() === activeEmployee.fullName.toLowerCase())
  );
  const empHistory = rawHistory.filter(rec => {
    if (attendanceFilter === 'All') return true;
    if (attendanceFilter === 'Leave') return rec.status === 'On Leave' || rec.status === 'Leave';
    return rec.status === attendanceFilter;
  });

  // Break & WFH state
  const [activeBreak, setActiveBreak] = useState<{ type: string; startAt: string } | null>(null);
  const [breakElapsedSec, setBreakElapsedSec] = useState(0);
  const [isWfh, setIsWfh] = useState(false);

  // Sync activeBreak from today's record (Fixes E36 Break Type Aliasing)
  useEffect(() => {
    if (todayRecord?.breaks) {
      const ongoing = todayRecord.breaks.find(b => !b.endAt && !(b as any).endTime);
      if (ongoing) {
        const normalizedType = normalizeBreakType(ongoing.type);
        setActiveBreak({ type: normalizedType, startAt: ongoing.startAt || (ongoing as any).startTime });
        return;
      }
    }
    setActiveBreak(null);
  }, [todayRecord?.id, JSON.stringify(todayRecord?.breaks)]);

  // Sync WFH flag from today's record
  useEffect(() => {
    setIsWfh(todayRecord?.isWfh ?? false);
  }, [todayRecord?.id, todayRecord?.isWfh]);

  // Multi-Device Real-Time Live Shift Sync (Fixes E37 Contract)
  const [, setLiveSyncTick] = useState(0);
  useEffect(() => {
    const syncInterval = setInterval(() => {
      setLiveSyncTick(t => t + 1);
    }, 2000);
    return () => clearInterval(syncInterval);
  }, []);

  // Break live timer ticker
  useEffect(() => {
    if (!activeBreak) { setBreakElapsedSec(0); return; }
    const calc = () => {
      setBreakElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 1000)));
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  // Live WORK seconds ticker — pauses when on a break, resumes when break ends
  const [liveWorkSec, setLiveWorkSec] = useState(0);
  useEffect(() => {
    if (!todayRecord?.checkInAt || todayRecord?.checkOutAt) {
      setLiveWorkSec(0);
      return;
    }
    const computeWorkSec = () => {
      const totalElapsedMs = Date.now() - new Date(todayRecord.checkInAt!).getTime();
      const completedBreakMs = (todayRecord.totalBreakMinutes || 0) * 60000;
      // If a break is currently active, subtract its elapsed time too (work is paused)
      const activeBreakMs = activeBreak
        ? Math.max(0, Date.now() - new Date(activeBreak.startAt).getTime())
        : 0;
      const workMs = Math.max(0, totalElapsedMs - completedBreakMs - activeBreakMs);
      setLiveWorkSec(Math.floor(workMs / 1000));
    };
    computeWorkSec();
    // Only tick every second when NOT on a break (work timer is frozen on break)
    if (activeBreak) return; // timer frozen — break ticker handles its own countdown
    const interval = setInterval(computeWorkSec, 1000);
    return () => clearInterval(interval);
  }, [todayRecord?.checkInAt, todayRecord?.checkOutAt, todayRecord?.totalBreakMinutes, activeBreak, JSON.stringify(todayRecord)]);

  const [attendanceViewMode, setAttendanceViewMode] = useState<'cards' | 'list'>('cards');
  const [editingProfileField, setEditingProfileField] = useState<string | null>(null);
  const [isEditingProfileSheet, setIsEditingProfileSheet] = useState(false);

  const calculateWorkHours = (record?: any) => {
    if (!record) return '0h 0m';
    if (record.workingMinutes) {
      const hrs = Math.floor(record.workingMinutes / 60);
      const mins = record.workingMinutes % 60;
      return `${hrs}h ${mins}m`;
    }
    if (record.checkInAt && record.checkOutAt) {
      const totalMs = new Date(record.checkOutAt).getTime() - new Date(record.checkInAt).getTime();
      const breakMs = (record.totalBreakMinutes || 0) * 60000;
      const workMs = Math.max(0, totalMs - breakMs);
      const hrs = Math.floor(workMs / 3600000);
      const mins = Math.floor((workMs % 3600000) / 60000);
      return `${hrs}h ${mins}m`;
    }
    if (record.checkInAt) {
      // Live: use liveWorkSec for real-time accuracy
      const hrs = Math.floor(liveWorkSec / 3600);
      const mins = Math.floor((liveWorkSec % 3600) / 60);
      const secs = liveWorkSec % 60;
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    return '0h 0m';
  };

  const getBreakColorConfig = (type?: string) => {
    switch (type) {
      case 'Tea Break':
        return {
          label: 'Tea Break',
          icon: Coffee,
          iconEmoji: '🍵',
          themeColor: '#f59e0b',
          ringClass: 'border-amber-500 bg-amber-500/10 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.25)]',
          badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
          iconClass: 'text-amber-400',
          btnBg: 'bg-amber-500 hover:bg-amber-400 text-amber-950',
          dotBg: 'bg-amber-400',
          progressBg: 'bg-amber-500'
        };
      case 'Meal Break':
      case 'Lunch Break':
        return {
          label: 'Meal Break',
          icon: UtensilsCrossed,
          iconEmoji: '🍱',
          themeColor: '#f43f5e',
          ringClass: 'border-rose-500 bg-rose-500/10 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.25)]',
          badgeBg: 'bg-rose-950/90 text-rose-300 border-rose-500/50',
          iconClass: 'text-rose-400',
          btnBg: 'bg-rose-500 hover:bg-rose-400 text-white',
          dotBg: 'bg-rose-400',
          progressBg: 'bg-rose-500'
        };
      case 'Team Huddle':
        return {
          label: 'Team Huddle',
          icon: Users,
          iconEmoji: '👥',
          themeColor: '#0ea5e9',
          ringClass: 'border-sky-500 bg-sky-500/10 text-sky-300 shadow-[0_0_25px_rgba(14,165,233,0.25)]',
          badgeBg: 'bg-sky-950/90 text-sky-300 border-sky-500/50',
          iconClass: 'text-sky-400',
          btnBg: 'bg-sky-500 hover:bg-sky-400 text-white',
          dotBg: 'bg-sky-400',
          progressBg: 'bg-sky-500'
        };
      case 'Team Meeting':
        return {
          label: 'Team Meeting',
          icon: Calendar,
          iconEmoji: '📅',
          themeColor: '#a855f7',
          ringClass: 'border-purple-500 bg-purple-500/10 text-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.25)]',
          badgeBg: 'bg-purple-950/90 text-purple-300 border-purple-500/50',
          iconClass: 'text-purple-400',
          btnBg: 'bg-purple-500 hover:bg-purple-400 text-white',
          dotBg: 'bg-purple-400',
          progressBg: 'bg-purple-500'
        };
      case 'Attainment / Training':
      case 'Training':
        return {
          label: 'Training',
          icon: GraduationCap,
          iconEmoji: '🎓',
          themeColor: '#10b981',
          ringClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.25)]',
          badgeBg: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
          iconClass: 'text-emerald-400',
          btnBg: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950',
          dotBg: 'bg-emerald-400',
          progressBg: 'bg-emerald-500'
        };
      case 'Activity':
      default:
        return {
          label: 'Activity',
          icon: Zap,
          iconEmoji: '⚡',
          themeColor: '#06b6d4',
          ringClass: 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.25)]',
          badgeBg: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50',
          iconClass: 'text-cyan-400',
          btnBg: 'bg-cyan-500 hover:bg-cyan-400 text-cyan-950',
          dotBg: 'bg-cyan-400',
          progressBg: 'bg-cyan-500'
        };
    }
  };

  const getTodayActivities = () => {
    const activities: { time: string; text: string; color: string }[] = [];
    if (!todayRecord) return activities;

    if (todayRecord.checkInAt) {
      activities.push({
        time: toISTTimeString(todayRecord.checkInAt),
        text: `Checked In ${todayRecord.isWfh ? '(Work From Home)' : '(Office GPS Verified)'}`,
        color: 'bg-emerald-400'
      });
    }

    if (todayRecord.breaks) {
      todayRecord.breaks.forEach(b => {
        const breakConfig = getBreakColorConfig(b.type);
        if (b.startAt) {
          activities.push({
            time: new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `${b.type} Started`,
            color: breakConfig.dotBg
          });
        }
        if (b.endAt) {
          activities.push({
            time: new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `Resumed Work (${b.durationMinutes || 0}m break completed)`,
            color: 'bg-blue-400'
          });
        }
      });
    }

    if (todayRecord.checkOutAt) {
      activities.push({
        time: new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Checked Out (Total Worked: ${calculateWorkHours(todayRecord)})`,
        color: 'bg-purple-400'
      });
    }

    return activities;
  };

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

  // Acquire Continuous Real-Time Geolocation (watchPosition)
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setGpsLocation({ 
          lat: pos.coords.latitude, 
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy) || 8
        });
        setGpsError(null);
      },
      err => {
        console.warn('Employee location watch prompt:', err.message);
        setGpsError(err.message || 'Location access denied or unavailable.');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const liveDistanceMeters = (gpsLocation && companyWorkZone)
    ? calculateGpsDistanceMeters(gpsLocation.lat, gpsLocation.lon, companyWorkZone.latitude, companyWorkZone.longitude)
    : null;

  const isVerifiedLocation = liveDistanceMeters !== null
    ? liveDistanceMeters <= companyWorkZone.radiusMeters
    : false;

  // Time-of-Day Break Classifier
  const getAutoBreakTypeByTime = (): 'Meal Break' | 'Tea Break' | 'Geo-Fence Auto Break' => {
    const now = new Date();
    const timeInMins = now.getHours() * 60 + now.getMinutes();

    // Afternoon: 12:00 PM (720 mins) to 3:30 PM (930 mins) -> Meal Break
    if (timeInMins >= 720 && timeInMins < 930) {
      return 'Meal Break';
    }
    // Evening: 3:30 PM (930 mins) to 6:30 PM (1110 mins) -> Tea Break
    if (timeInMins >= 930 && timeInMins < 1110) {
      return 'Tea Break';
    }
    return 'Geo-Fence Auto Break';
  };

  // GPS location verification is active for Check-In & Check-Out.
  // Auto-break on geofence departure is disabled per configuration.

  // Auto-end any leftover Geo-Fence Auto Break entries and resume shift!
  useEffect(() => {
    if (activeBreak?.type === 'Geo-Fence Auto Break' && todayRecord) {
      handleEndBreak();
    }
  }, [activeBreak?.type, todayRecord?.id]);

  // Ref flags to prevent repeating break escalation notifications
  const breakEscalationFlagsRef = useRef<{ m25: boolean; m30: boolean; m50: boolean }>({ m25: false, m30: false, m50: false });

  // Reset escalation flags when activeBreak changes
  useEffect(() => {
    breakEscalationFlagsRef.current = { m25: false, m30: false, m50: false };
  }, [activeBreak?.startAt]);

  // Break Extension Escalation Timers (25m Warning, 30m Alert, 50m Auto-Off Rule)
  useEffect(() => {
    if (!activeBreak) return;

    const checkEscalations = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(activeBreak.startAt).getTime()) / 1000));
      const elapsedMins = Math.floor(elapsedSec / 60);

      // Escalation Rule 1: 25 Minutes Warning (5 minutes before 30m limit)
      if (elapsedMins >= 25 && elapsedMins < 30 && !breakEscalationFlagsRef.current.m25) {
        breakEscalationFlagsRef.current.m25 = true;
        triggerHaptic('warning');
        setActionFeedback({
          success: false,
          message: `BREAK WARNING: You have been on ${activeBreak.type} for 25 minutes (5 mins left before 30-min limit).`
        });
      }

      // Escalation Rule 2: 30 Minutes Alert (Overtime Break Limit)
      if (elapsedMins >= 30 && elapsedMins < 50 && !breakEscalationFlagsRef.current.m30) {
        breakEscalationFlagsRef.current.m30 = true;
        triggerHaptic('error');
        setActionFeedback({
          success: false,
          message: `BREAK LIMIT REACHED: You have exceeded 30 minutes on ${activeBreak.type}. Please return to work.`
        });
        addAuditLog('ATTENDANCE_BREAK_EXTENDED', activeEmployee.id, `${activeEmployee.fullName} extended ${activeBreak.type} past 30 minutes.`);
      }

      // Escalation Rule 3: 50 Minutes AUTO-OFF RULE (Hard Cutoff & Auto-End Break)
      if (elapsedMins >= 50 && !breakEscalationFlagsRef.current.m50) {
        breakEscalationFlagsRef.current.m50 = true;
        triggerHaptic('error');
        handleEndBreak();
        setActionFeedback({
          success: false,
          message: `BREAK AUTO-STOPPED: Maximum 50-minute break limit reached for ${activeBreak.type}. Shift resumed.`
        });
        addAuditLog('ATTENDANCE_BREAK_AUTO_STOP', activeEmployee.id, `Break auto-stopped at 50-minute maximum limit for ${activeEmployee.fullName}.`);
      }
    };

    const interval = setInterval(checkEscalations, 5000);
    checkEscalations();
    return () => clearInterval(interval);
  }, [activeBreak, activeEmployee]);

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

  const handleSelfCheckIn = () => {
    triggerHaptic('medium');
    const hasConsent = localStorage.getItem('kss_biometric_consent') === 'true';
    if (!hasConsent) {
      setIsConsentModalOpen(true);
    } else {
      const isEnrolled = getEmployeeDescriptor(activeEmployee.id) !== null;
      if (!isEnrolled) {
        setIsEnrollFaceModalOpen(true);
      } else {
        setIsFaceModalOpen(true);
      }
    }
  };

  const executeCheckInProcess = async () => {
    setIsCheckingIn(true);
    setActionFeedback(null);
    
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
    
    const res = await recordCheckOut(activeEmployee.id, gpsLocation?.lat, gpsLocation?.lon, gpsLocation?.accuracy);
    
    if (res.success) triggerHaptic('success');
    else triggerHaptic('error');
    
    setActionFeedback({ success: res.success, message: res.message });
  };

  const handleStartBreak = (type: BreakType) => {
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
    const breakStart = activeBreak.startAt;
    const durationMinutes = Math.max(1, Math.round((new Date(endAt).getTime() - new Date(breakStart).getTime()) / 60000));
    
    const existingBreaks = todayRecord.breaks || [];
    const updatedBreaks = existingBreaks.map(b => {
      const isOpen = !b.endAt && !(b as any).endTime;
      const matchesStart = b.startAt === breakStart || (b as any).startTime === breakStart;
      if (isOpen || matchesStart) {
        return {
          ...b,
          startAt: b.startAt || (b as any).startTime || breakStart,
          endAt,
          endTime: endAt,
          durationMinutes
        };
      }
      return b;
    });

    // Calculate total break minutes dynamically
    const totalMins = updatedBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

    // Instantly clear local activeBreak state for 0ms UI response
    setActiveBreak(null);

    updateAttendanceRecord(todayRecord.id, { 
      breaks: updatedBreaks, 
      totalBreakMinutes: totalMins
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

  // Genuine Real Webcam Camera Photo Capture (Fixes E33 Contract)
  const handleRealCameraPhotoCapture = async () => {
    setIsCapturingCamera(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        // Short 300ms pause to allow camera sensor exposure auto-adjust
        await new Promise(r => setTimeout(r, 300));

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const realPhotoUrl = canvas.toDataURL('image/jpeg', 0.9);
          setProfilePhoto(realPhotoUrl);
          setActionFeedback({ success: true, message: '✓ Genuine webcam camera photo snapshot captured!' });
        }
        stream.getTracks().forEach(track => track.stop());
      } else {
        // Fallback to biometric enrollment modal if mediaDevices is restricted
        setIsEnrollFaceModalOpen(true);
      }
    } catch (err) {
      console.warn('[EmployeePortal] Direct webcam stream error, opening biometric face modal', err);
      setIsEnrollFaceModalOpen(true);
    } finally {
      setIsCapturingCamera(false);
    }
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
    setIsEditingProfileSheet(false);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 w-full">
      
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
        <div className={`bg-[var(--bg-secondary)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border-subtle)] w-full md:w-auto ${animations.stagger.item(2)}`}>
          <div className="text-xs text-[var(--text-tertiary)] font-medium flex flex-row md:flex-col items-center justify-between md:justify-center md:items-end gap-2">
            <span className="uppercase tracking-wider font-semibold text-[10px] text-slate-400">Today's Status</span>
            <strong className={`font-bold px-3 py-1 rounded-lg border text-xs sm:text-sm ${
              todayRecord?.status === 'Late'
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : todayRecord?.status === 'Absent'
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                : todayRecord?.status === 'Leave'
                ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                : todayRecord?.isWfh
                ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                : todayRecord?.status === 'On Time' || todayRecord?.status === 'Present'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-slate-400 bg-slate-800/50 border-slate-700'
            }`}>
              {todayRecord?.status || 'Not Checked In'}
              {todayRecord?.isWfh && ' (WFH)'}
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
          
          {/* 📢 High-Visibility Official Company Broadcast Announcement Banner */}
          {(() => {
            const broadcasts = notifications.filter(n =>
              (n.type === 'ADMIN_BROADCAST' || n.type === 'BROADCAST' || n.audience?.includes('ALL')) &&
              n.title && n.body
            );
            if (broadcasts.length === 0) return null;
            const latestBc = broadcasts[0];

            return (
              <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-indigo-950/90 border-2 border-blue-500/40 rounded-3xl p-5 shadow-2xl space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between gap-3 relative z-10 border-b border-blue-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-lg shadow-inner">
                      📢
                    </span>
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase block">
                        OFFICIAL COMPANY ANNOUNCEMENT
                      </span>
                      <h3 className="text-sm font-black text-white">{latestBc.title}</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                    {latestBc.actorName ? `From ${latestBc.actorName}` : 'HR & Management'}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium pl-1">
                  {latestBc.body}
                </p>
              </div>
            );
          })()}

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
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOfficeWfh = companyWideWfhDates.includes(todayStr);
                    const isApprovedWfhToday = isOfficeWfh ||
                      (activeEmployee.approvedWfhDates || []).includes(todayStr) ||
                      leaveRequests.some(r =>
                        r.type === 'WFH' &&
                        r.status === 'Approved' &&
                        (r.employeeId === activeEmployee.employeeId || r.employeeId === activeEmployee.id || r.employeeName === activeEmployee.fullName) &&
                        todayStr >= r.startDate &&
                        todayStr <= r.endDate
                      );

                    return isApprovedWfhToday ? (
                      <div className="mb-3 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm">
                        <Home className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isOfficeWfh ? '🏢 Office-Wide WFH Day — GPS Radius Bypassed' : '🏠 Work From Home Approved — GPS Radius Bypassed'}</span>
                      </div>
                    ) : (
                      <div className="mb-3 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm">
                        <ScanFace className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                        <span>AI Face Biometric Camera Verification Active</span>
                      </div>
                    );
                  })()}

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
                    <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
                      {/* Circle 1: Checked In Status */}
                      <button 
                        onClick={handleSelfCheckOut}
                        className={`relative flex flex-col items-center justify-center w-[160px] h-[160px] sm:w-[170px] sm:h-[170px] rounded-full border-[3px] border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] shadow-[var(--shadow-glow-emerald)] transition-all cursor-pointer outline-none ${animations.tap}`}
                      >
                        <div className="absolute inset-0 bg-[var(--gradient-success)] opacity-10 rounded-full" />
                        <CheckCircle2 className="w-10 h-10 mb-2" strokeWidth={2} />
                        <span className="font-bold text-xs sm:text-sm tracking-wide">Checked In</span>
                        <span className="text-[10px] font-mono mt-1 opacity-80">
                          {toISTTimeString(todayRecord.checkInAt)}
                        </span>
                      </button>

                      {/* Circle 2: Active Break Live Timer (Dynamic Color & Icon) */}
                      {activeBreak && (() => {
                        const cfg = getBreakColorConfig(activeBreak.type);
                        const BreakIcon = cfg.icon;
                        return (
                          <div className={`relative flex flex-col items-center justify-center w-[160px] h-[160px] sm:w-[170px] sm:h-[170px] rounded-full border-[3px] ${cfg.ringClass}`}>
                            <BreakIcon className={`w-9 h-9 mb-1 ${cfg.iconClass}`} />
                            <span className="font-extrabold text-xs sm:text-sm tracking-wide text-white truncate max-w-[130px] text-center">
                              {activeBreak.type}
                            </span>
                            <span className={`text-xs font-mono font-black mt-1 px-3 py-0.5 rounded-full border shadow-inner ${cfg.badgeBg}`}>
                              {String(Math.floor(breakElapsedSec / 60)).padStart(2, '0')}:{String(breakElapsedSec % 60).padStart(2, '0')}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="relative flex flex-col items-center justify-center w-[180px] h-[180px] rounded-full border-[3px] border-purple-500/50 bg-purple-950/20 text-purple-300 shadow-lg shadow-purple-950/50 text-center p-3">
                      <LogOut className="w-8 h-8 mb-1 text-purple-400 opacity-80" />
                      <span className="font-extrabold text-sm tracking-wide text-white">Shift Complete</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-400 mt-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        Worked: {calculateWorkHours(todayRecord)}
                      </span>
                    </div>
                  )}
                  
                  {/* Break & Activity Actions (if checked in) */}
                  {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
                    <div className="w-full mt-4">
                       {activeBreak ? (() => {
                         const cfg = getBreakColorConfig(activeBreak.type);
                         return (
                           <button onClick={handleEndBreak} className={`w-full py-2.5 rounded-2xl ${cfg.btnBg} font-black text-xs shadow-lg flex items-center justify-center gap-2 ${animations.tap}`}>
                             <StopCircle className="w-4 h-4" /> End {activeBreak.type} ({String(Math.floor(breakElapsedSec / 60)).padStart(2, '0')}:{String(breakElapsedSec % 60).padStart(2, '0')})
                           </button>
                         );
                       })() : (
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           <button onClick={() => handleStartBreak('Tea Break')} className="px-2.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
                             🍵 Tea Break
                           </button>
                           <button onClick={() => handleStartBreak('Meal Break')} className="px-2.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
                             🍱 Meal Break
                           </button>
                           <button onClick={() => handleStartBreak('Team Huddle')} className="px-2.5 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
                             👥 Team Huddle
                           </button>
                           <button onClick={() => handleStartBreak('Team Meeting')} className="px-2.5 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
                             📅 Team Meeting
                           </button>
                           <button onClick={() => handleStartBreak('Attainment / Training')} className="px-2.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
                             🎓 Training
                           </button>
                           <button onClick={() => handleStartBreak('Activity')} className="px-2.5 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
                             ⚡ Activity
                           </button>
                         </div>
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
                      !(companyWideWfhDates.includes(new Date().toISOString().split('T')[0]) ||
                        (activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0]) ||
                        leaveRequests.some(r => r.type === 'WFH' && r.status === 'Approved' && (r.employeeId === activeEmployee.employeeId || r.employeeId === activeEmployee.id) && new Date().toISOString().split('T')[0] >= r.startDate && new Date().toISOString().split('T')[0] <= r.endDate))
                        ? 'bg-transparent border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed'
                        : isWfh
                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                          : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-sky-500/30'
                    } ${animations.tap}`}
                  >
                    {!(companyWideWfhDates.includes(new Date().toISOString().split('T')[0]) ||
                       (activeEmployee.approvedWfhDates || []).includes(new Date().toISOString().split('T')[0]) ||
                       leaveRequests.some(r => r.type === 'WFH' && r.status === 'Approved' && (r.employeeId === activeEmployee.employeeId || r.employeeId === activeEmployee.id) && new Date().toISOString().split('T')[0] >= r.startDate && new Date().toISOString().split('T')[0] <= r.endDate))
                      ? '🔒 WFH Locked (Requires Approval)'
                      : companyWideWfhDates.includes(new Date().toISOString().split('T')[0])
                        ? '🏢 Office-Wide WFH Active'
                        : isWfh
                          ? '🏠 Working From Home'
                          : 'Switch to WFH'}
                  </button>
                )}
              </div>
            </div>

            {/* Right: Today's Activity Feed Card */}
            <div className={`bg-slate-900/90 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between shadow-xl min-h-[360px] ${animations.stagger.item(2)}`}>
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Today's Activity
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-md">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="space-y-4">
                  {getTodayActivities().length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs font-medium space-y-2">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
                      <p>No shift activities recorded today yet.</p>
                      <p className="text-[10px] text-slate-600">Tap "Tap to Check In" to start your work day.</p>
                    </div>
                  ) : (
                    getTodayActivities().map((act, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                        <span className="font-mono text-slate-400 font-bold shrink-0 w-16">{act.time}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${act.color} shrink-0 animate-pulse`} />
                        <span className="text-slate-200 font-semibold">{act.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {todayRecord?.checkInAt && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                  {/* Live Work Timer */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-emerald-400" />
                      {activeBreak ? (
                        <span className="text-amber-400 font-semibold">Work Timer Paused</span>
                      ) : (
                        <span>Working Time</span>
                      )}
                    </span>
                    <span className={`font-mono font-bold px-2.5 py-0.5 rounded-md border text-sm ${
                      activeBreak
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      {(() => {
                        const hrs = Math.floor(liveWorkSec / 3600);
                        const mins = Math.floor((liveWorkSec % 3600) / 60);
                        const secs = liveWorkSec % 60;
                        return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
                      })()}
                    </span>
                  </div>
                  {/* Active Break Timer */}
                  {activeBreak && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-400">{activeBreak.type}</span>
                      </span>
                      <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 text-sm animate-pulse">
                        {String(Math.floor(breakElapsedSec / 3600)).padStart(2, '0')}h {String(Math.floor((breakElapsedSec % 3600) / 60)).padStart(2, '0')}m {String(breakElapsedSec % 60).padStart(2, '0')}s
                      </span>
                    </div>
                  )}

                  {/* Live Productivity & Multi-Color Shift Distribution Meter */}
                  {(() => {
                    let teaSecs = 0;
                    let mealSecs = 0;
                    let huddleSecs = 0;
                    let meetingSecs = 0;
                    let trainingSecs = 0;
                    let activitySecs = 0;

                    (todayRecord.breaks || []).forEach(b => {
                      const durSec = ((b.durationMinutes || 0) * 60) + ((!b.endAt && activeBreak?.startAt === b.startAt) ? breakElapsedSec : 0);
                      if (b.type === 'Tea Break') teaSecs += durSec;
                      else if (b.type === 'Meal Break' || b.type === 'Lunch Break') mealSecs += durSec;
                      else if (b.type === 'Team Huddle') huddleSecs += durSec;
                      else if (b.type === 'Team Meeting') meetingSecs += durSec;
                      else if (b.type === 'Attainment / Training' || b.type === 'Training') trainingSecs += durSec;
                      else activitySecs += durSec;
                    });

                    if (activeBreak && !(todayRecord.breaks || []).some(b => !b.endAt)) {
                      const dur = breakElapsedSec;
                      if (activeBreak.type === 'Tea Break') teaSecs += dur;
                      else if (activeBreak.type === 'Meal Break' || activeBreak.type === 'Lunch Break') mealSecs += dur;
                      else if (activeBreak.type === 'Team Huddle') huddleSecs += dur;
                      else if (activeBreak.type === 'Team Meeting') meetingSecs += dur;
                      else if (activeBreak.type === 'Attainment / Training' || activeBreak.type === 'Training') trainingSecs += dur;
                      else activitySecs += dur;
                    }

                    const totalBreakSecs = teaSecs + mealSecs + huddleSecs + meetingSecs + trainingSecs + activitySecs;
                    const grandTotalSecs = liveWorkSec + totalBreakSecs;

                    const workPct = grandTotalSecs > 0 ? Math.round((liveWorkSec / grandTotalSecs) * 100) : 100;
                    const teaPct = grandTotalSecs > 0 ? Math.round((teaSecs / grandTotalSecs) * 100) : 0;
                    const mealPct = grandTotalSecs > 0 ? Math.round((mealSecs / grandTotalSecs) * 100) : 0;
                    const huddlePct = grandTotalSecs > 0 ? Math.round((huddleSecs / grandTotalSecs) * 100) : 0;
                    const meetingPct = grandTotalSecs > 0 ? Math.round((meetingSecs / grandTotalSecs) * 100) : 0;
                    const trainingPct = grandTotalSecs > 0 ? Math.round((trainingSecs / grandTotalSecs) * 100) : 0;
                    const activityPct = Math.max(0, 100 - (workPct + teaPct + mealPct + huddlePct + meetingPct + trainingPct));

                    return (
                      <div className="pt-2 space-y-2 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            Shift Productivity Ratio
                          </span>
                          <span className="text-emerald-400 font-mono">{workPct}% Work</span>
                        </div>

                        {/* Multi-Color Segmented Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                          {workPct > 0 && <div style={{ width: `${workPct}%` }} className="bg-emerald-500 transition-all duration-500 h-full" title={`Work: ${workPct}%`} />}
                          {teaPct > 0 && <div style={{ width: `${teaPct}%` }} className="bg-amber-500 transition-all duration-500 h-full" title={`Tea Break: ${teaPct}%`} />}
                          {mealPct > 0 && <div style={{ width: `${mealPct}%` }} className="bg-rose-500 transition-all duration-500 h-full" title={`Meal Break: ${mealPct}%`} />}
                          {huddlePct > 0 && <div style={{ width: `${huddlePct}%` }} className="bg-sky-500 transition-all duration-500 h-full" title={`Team Huddle: ${huddlePct}%`} />}
                          {meetingPct > 0 && <div style={{ width: `${meetingPct}%` }} className="bg-purple-500 transition-all duration-500 h-full" title={`Team Meeting: ${meetingPct}%`} />}
                          {trainingPct > 0 && <div style={{ width: `${trainingPct}%` }} className="bg-emerald-400 transition-all duration-500 h-full" title={`Training: ${trainingPct}%`} />}
                          {activityPct > 0 && <div style={{ width: `${activityPct}%` }} className="bg-cyan-500 transition-all duration-500 h-full" title={`Activity: ${activityPct}%`} />}
                        </div>

                        {/* Multi-Color Legend */}
                        <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-400 font-semibold pt-0.5">
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            Work ({workPct}%)
                          </span>
                          {teaPct > 0 && (
                            <span className="flex items-center gap-1 text-amber-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                              Tea ({teaPct}%)
                            </span>
                          )}
                          {mealPct > 0 && (
                            <span className="flex items-center gap-1 text-rose-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                              Meal ({mealPct}%)
                            </span>
                          )}
                          {huddlePct > 0 && (
                            <span className="flex items-center gap-1 text-sky-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                              Huddle ({huddlePct}%)
                            </span>
                          )}
                          {meetingPct > 0 && (
                            <span className="flex items-center gap-1 text-purple-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                              Meeting ({meetingPct}%)
                            </span>
                          )}
                          {trainingPct > 0 && (
                            <span className="flex items-center gap-1 text-emerald-300 font-bold">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                              Training ({trainingPct}%)
                            </span>
                          )}
                          {activityPct > 0 && (
                            <span className="flex items-center gap-1 text-cyan-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                              Activity ({activityPct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>



          {/* Break & Activity Management */}
          {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                    <Coffee className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Shift Activity & Break Management</h4>
                    <p className="text-[11px] text-slate-400">Total break / activity time today: <span className="font-mono text-slate-300 font-bold">{todayRecord?.totalBreakMinutes || 0}m</span></p>
                  </div>
                </div>

                {activeBreak && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider">{activeBreak.type} Active</span>
                      <span className="text-base font-mono font-bold text-white">{formatBreakTime(breakElapsedSec)}</span>
                    </div>
                    <button onClick={handleEndBreak} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md">
                      <StopCircle className="w-4 h-4" /> End Activity
                    </button>
                  </div>
                )}
              </div>

              {!activeBreak && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2">
                  <button onClick={() => handleStartBreak('Tea Break')} className="px-3 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-base">🍵</span>
                    <span>Tea Break</span>
                  </button>
                  <button onClick={() => handleStartBreak('Meal Break')} className="px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-base">🍱</span>
                    <span>Meal Break</span>
                  </button>
                  <button onClick={() => handleStartBreak('Team Huddle')} className="px-3 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-xs rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-base">👥</span>
                    <span>Team Huddle</span>
                  </button>
                  <button onClick={() => handleStartBreak('Team Meeting')} className="px-3 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-xs rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-base">📅</span>
                    <span>Team Meeting</span>
                  </button>
                  <button onClick={() => handleStartBreak('Attainment / Training')} className="px-3 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-base">🎓</span>
                    <span>Attainment/Training</span>
                  </button>
                  <button onClick={() => handleStartBreak('Activity')} className="px-3 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-base">⚡</span>
                    <span>Activity</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. ATTENDANCE HISTORY TAB */}
      {activeTab === 'emp_attendance' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 min-h-[500px] flex flex-col space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Attendance History
            </h2>
            <span className="text-xs text-slate-400 font-mono">{empHistory.length} Records</span>
          </div>

          {/* View Mode Toggle & Filter Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
            {/* Attendance Status Dropdown Filter */}
            <div className="flex items-center justify-between sm:justify-start gap-2.5 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl shadow-inner w-full sm:w-auto">
              <div className="flex items-center gap-2 shrink-0">
                <Filter className="w-4 h-4 text-blue-400 shrink-0" />
                <label htmlFor="attendance-status-filter" className="text-xs font-bold text-slate-300 shrink-0">
                  Filter Status:
                </label>
              </div>
              <select
                id="attendance-status-filter"
                value={attendanceFilter}
                onChange={(e) => {
                  triggerHaptic();
                  setAttendanceFilter(e.target.value as any);
                }}
                className="bg-slate-900 border border-slate-700/80 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:border-blue-500 focus:outline-hidden cursor-pointer hover:border-blue-500/50 transition-all min-w-[130px]"
              >
                <option value="All">All Statuses ({empHistory.length})</option>
                <option value="Present">Present Only</option>
                <option value="Late">Late Only</option>
                <option value="Absent">Absent Only</option>
                <option value="Leave">On Leave / WFH</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto justify-center">
              <button
                onClick={() => setAttendanceViewMode('list')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  attendanceViewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> List View
              </button>
              <button
                onClick={() => setAttendanceViewMode('cards')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  attendanceViewMode === 'cards' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Cards View
              </button>
            </div>
          </div>
          
          {attendanceViewMode === 'list' ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-md custom-scrollbar">
              {/* Mobile Scroll Swipe Indicator */}
              <div className="sm:hidden px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <span>←</span> Swipe left/right for full details <span>→</span>
                </span>
                <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">6 Columns</span>
              </div>
              <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5 w-36">Date & Day</th>
                    <th className="px-4 py-3.5 w-32">Status</th>
                    <th className="px-4 py-3.5 w-32">Check In</th>
                    <th className="px-4 py-3.5 w-32">Check Out</th>
                    <th className="px-4 py-3.5 w-24">Break</th>
                    <th className="px-4 py-3.5 w-32 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {empHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">No attendance records found.</td>
                    </tr>
                  ) : (
                    empHistory.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-white font-mono whitespace-nowrap w-36">
                          {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap w-32">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            rec.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            rec.status === 'Late' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            rec.status === 'Work From Home' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-200 whitespace-nowrap w-32">
                          {rec.checkInAt ? toISTTimeString(rec.checkInAt) : '--:--'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-200 whitespace-nowrap w-32">
                          {rec.checkOutAt ? toISTTimeString(rec.checkOutAt) : <span className="text-emerald-400 text-[11px] font-bold">Active Shift</span>}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-400 whitespace-nowrap w-24">
                          {rec.totalBreakMinutes ? `${rec.totalBreakMinutes}m` : '0m'}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-white text-right whitespace-nowrap w-32">
                          {calculateWorkHours(rec)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Animated Cards View */
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
              <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-950/50 rounded-2xl border border-slate-800 border-dashed">
                <Calendar className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-white font-semibold text-sm">No records found</h3>
                <p className="text-slate-500 text-xs mt-1">Check back after you've checked in, or try a different filter.</p>
              </div>
            ) : (
              empHistory.map((rec) => {
                const statusColorMap = {
                  'Present': '#10b981', // emerald-500
                  'Late': '#f59e0b', // amber-500
                  'Absent': '#f43f5e', // rose-500
                  'On Leave': '#8b5cf6', // violet-500
                  'Leave': '#8b5cf6', // violet-500
                };
                const statusColor = (statusColorMap as any)[rec.status] || '#64748b'; // slate-500

                return (
                  <motion.div
                    key={rec.id}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-sm"
                  >
                    {/* Row 1: Date + Status + Working Hours */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* Date Cube */}
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className="text-lg font-black text-white leading-none mt-0.5">{new Date(rec.date).getDate()}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: statusColor, boxShadow: `0 0 10px ${statusColor}80` }}
                            />
                            <span className="text-sm font-bold text-white">{rec.status}</span>
                            {rec.isWfh && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">🏠 WFH</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {new Date(rec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-white tabular-nums">
                          {rec.workingMinutes ? `${Math.floor(rec.workingMinutes/60)}h ${rec.workingMinutes%60}m` : '--'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">Working Time</div>
                      </div>
                    </div>

                    {/* Row 2: Check In/Out Times */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-900/60 rounded-xl p-3 mb-3 border border-slate-800/50">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Check In</div>
                        <div className="font-mono font-bold text-white text-sm">
                          {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Check Out</div>
                        <div className="font-mono font-bold text-white text-sm">
                          {rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : <span className="text-emerald-400 text-xs animate-pulse">Active</span>}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Break + GPS + Method */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {(rec.totalBreakMinutes || 0) > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ☕ Break: {rec.totalBreakMinutes}m
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        rec.locationVerified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        <MapPin className="w-3 h-3" />
                        {rec.locationVerified ? 'GPS Verified' : 'Unverified'}
                      </span>
                      {rec.attendanceMethod && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {rec.attendanceMethod}
                        </span>
                      )}
                      {rec.notes && (
                        <span className="text-[10px] text-slate-400 italic truncate max-w-[200px]" title={rec.notes}>
                          {rec.notes}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
          )}
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

      {/* 5. TEAM DIRECTORY TAB */}
      {(activeTab === 'emp_directory' || activeTab === 'emp_team') && (
        <EmployeeTeamDirectory />
      )}

      {/* 6. PAYSLIPS TAB */}
      {activeTab === 'emp_payslips' && (
        <EmployeePayslips />
      )}

      {/* 7. READ-ONLY PROFILE SUMMARY OR UPDATE PROFILE SHEET TAB */}
      {activeTab === 'emp_profile' && (
        <div className="w-full space-y-6 text-xs">
          
          {/* Header Bar */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                {isEditingProfileSheet ? 'Update Employee Profile Sheet' : 'My Official Profile Details'}
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {isEditingProfileSheet
                  ? 'Modify your avatar, face photo, skills, address, and account preferences.'
                  : 'View your official employment details, contact numbers, emergency details, and skills.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <Check className="w-3.5 h-3.5" /> Profile Updated!
                </span>
              )}

              {isEditingProfileSheet ? (
                <button
                  onClick={() => setIsEditingProfileSheet(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Return to Profile Details</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsEditingProfileSheet(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-blue-900/40 cursor-pointer transition-all"
                >
                  <Edit className="w-4 h-4" />
                  <span>Update Profile Details</span>
                </button>
              )}
            </div>
          </div>

          {!isEditingProfileSheet ? (
            /* ============================================================== */
            /* VIEW 1: READ-ONLY USER DETAILS SUMMARY CARD                    */
            /* ============================================================== */
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Profile Hero Box */}
              <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  <img
                    src={profilePhoto || activeEmployee.profilePhotoUrl}
                    alt={fullName}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-slate-800 shadow-2xl shadow-blue-500/20"
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold bg-blue-500/10 text-blue-400 px-3 py-0.5 rounded-lg border border-blue-500/20">
                        {activeEmployee.employeeId}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold bg-slate-950 px-3 py-0.5 rounded-lg border border-slate-800">
                        {activeEmployee.department}
                      </span>
                      <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                        {activeEmployee.status}
                      </span>
                    </div>
                    <h1 className="text-2xl font-black text-white">{fullName}</h1>
                    <p className="text-xs text-slate-400 font-medium">{activeEmployee.designation} • {settings.companyName}</p>
                    <p className="text-[11px] text-slate-500">Joined on {activeEmployee.joiningDate || '2026-01-15'}</p>
                  </div>
                </div>
              </div>

              {/* Face Biometric Status & AI Recognition Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 rounded-3xl border border-blue-500/30 p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                      <ScanFace className="w-4 h-4 text-blue-400" />
                      Face Biometric Recognition &amp; AI Neural Template
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Your registered face biometric template is used for zero-touch camera attendance verification.
                    </p>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${
                    activeEmployee.isFaceEnrolled || activeEmployee.faceDescriptor
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {activeEmployee.isFaceEnrolled || activeEmployee.faceDescriptor ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Face Biometric Enrolled</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Biometric Template Pending</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEnrollFaceModalOpen(true)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-900/40"
                  >
                    <Sparkles className="w-4 h-4 text-blue-200 animate-pulse" />
                    <span>📸 Register Biometric Face Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTestFaceModalOpen(true)}
                    className="px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <ScanFace className="w-4 h-4 text-emerald-400" />
                    <span>🔍 Test Facial Recognition Accuracy</span>
                  </button>
                </div>
              </div>

              {/* Grid 1: Personal & Employment Info */}
              <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <User className="w-4 h-4" /> Personal &amp; Employment Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Legal Name</span>
                    <span className="text-xs font-bold text-white">{fullName}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Company Email</span>
                    <span className="text-xs font-mono font-bold text-blue-300">{activeEmployee.email}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mobile Phone</span>
                    <span className="text-xs font-mono font-bold text-white">{phone || 'Not provided'}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gender</span>
                    <span className="text-xs font-bold text-white">{gender}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</span>
                    <span className="text-xs font-mono font-bold text-white">{dateOfBirth || 'Not provided'}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Work Location</span>
                    <span className="text-xs font-bold text-white">{activeEmployee.workLocation || 'AGPS Nagar HQ Campus'}</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 sm:col-span-2 md:col-span-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Shift Schedule</span>
                    <span className="text-xs font-bold text-slate-200">{preferredShift || activeEmployee.shift || 'General Shift (09:00 - 18:00)'}</span>
                  </div>
                </div>
              </div>

              {/* Grid 2: Address & Emergency Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Address Card */}
                <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <MapPin className="w-4 h-4" /> Residential Address
                  </h3>

                  <div className="space-y-3">
                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Current Address</span>
                      <span className="text-xs font-bold text-slate-200">{currentAddress || 'Not set'}</span>
                    </div>

                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Permanent Address</span>
                      <span className="text-xs font-bold text-slate-200">{permanentAddress ? `${permanentAddress}, ${city}, ${state} ${postalCode}` : 'Not set'}</span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Card */}
                <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Phone className="w-4 h-4" /> Emergency Contact
                  </h3>

                  <div className="space-y-3">
                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Emergency Phone</span>
                      <span className="text-xs font-mono font-bold text-rose-300">{emergencyContact || 'Not set'}</span>
                    </div>

                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Relationship</span>
                      <span className="text-xs font-bold text-slate-200">{emergencyRelationship || 'Family'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Grid 3: Bio & Skills */}
              <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Sparkles className="w-4 h-4" /> Professional Bio &amp; Technical Skills
                </h3>

                <div className="space-y-3">
                  <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bio / Overview</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">{bio || 'No professional bio added yet.'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Technical Skills</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {skills.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">No skills listed yet.</span>
                      ) : (
                        skills.map((skill, idx) => (
                          <span key={idx} className="px-3 py-1.5 rounded-xl bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold text-xs">
                            {skill}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>



            </div>
          ) : (
            /* ============================================================== */
            /* VIEW 2: COMPLETE UPDATE PROFILE SHEET FORM                     */
            /* ============================================================== */
            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-8 animate-in fade-in duration-200">
              
              <form onSubmit={handleSaveProfile} className="space-y-8">
                
                {/* SECTION A: FACE PHOTO & AVATAR EDITOR */}
                <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Face Photo &amp; Profile Avatar
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

                        {/* Real Webcam Camera Photo Capture */}
                        <button
                          type="button"
                          onClick={handleRealCameraPhotoCapture}
                          disabled={isCapturingCamera}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-slate-700"
                        >
                          <Camera className="w-3.5 h-3.5 text-blue-400" />
                          <span>{isCapturingCamera ? 'Capturing Snapshot...' : '📸 Capture Photo via Webcam'}</span>
                        </button>

                        {/* Explicit Face Biometric Registration Button */}
                        <button
                          type="button"
                          onClick={() => setIsEnrollFaceModalOpen(true)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-900/40"
                          title="Register your official biometric face template using your webcam"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
                          <span>📸 Register Biometric Face Template</span>
                        </button>

                        {/* Test Facial Recognition Accuracy Button */}
                        <button
                          type="button"
                          onClick={() => setIsTestFaceModalOpen(true)}
                          className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                        >
                          <ScanFace className="w-3.5 h-3.5 text-emerald-400" />
                          <span>🔍 Test Facial Recognition Accuracy</span>
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

                {/* SECTION B: PERSONAL DETAILS FORM */}
                <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-purple-400 flex items-center gap-2">
                    <User className="w-4 h-4" /> Personal Information &amp; Contact Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Mobile Phone</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Gender</label>
                      <select
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-Binary">Non-Binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={e => setDateOfBirth(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: ADDRESS & EMERGENCY CONTACTS */}
                <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Address &amp; Emergency Contacts
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-blue-400 hover:text-blue-300 transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={sameAsPermanentAddress}
                        onChange={e => handleSameAsPermanentToggle(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>SAME AS PERMANENT</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Permanent Address</label>
                      <input
                        type="text"
                        value={permanentAddress}
                        onChange={e => {
                          const val = e.target.value;
                          setPermanentAddress(val);
                          if (sameAsPermanentAddress) {
                            setCurrentAddress(val);
                          }
                        }}
                        placeholder="Enter permanent residential address"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Current Address</label>
                      <input
                        type="text"
                        value={currentAddress}
                        onChange={e => {
                          setCurrentAddress(e.target.value);
                          if (sameAsPermanentAddress && e.target.value !== permanentAddress) {
                            setSameAsPermanentAddress(false);
                          }
                        }}
                        placeholder="Enter current address"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Emergency Phone</label>
                      <input
                        type="text"
                        value={emergencyContact}
                        onChange={e => setEmergencyContact(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Emergency Relationship</label>
                      <input
                        type="text"
                        value={emergencyRelationship}
                        onChange={e => setEmergencyRelationship(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION D: BIO & SKILLS */}
                <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Professional Bio &amp; Technical Skills
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Professional Bio / Summary</label>
                      <textarea
                        rows={3}
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium focus:outline-hidden focus:border-blue-500 transition-colors leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-2">Technical &amp; Operational Skills</label>
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
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-blue-500 text-xs"
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

                {/* SHEET FOOTER ACTIONS */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfileSheet(false)}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-900/40"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save &amp; Update Profile Sheet</span>
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* SECTION E: ACCOUNT SECURITY & PASSWORD CHANGE (Real-Time) */}
          <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4 pt-4 mt-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400" />
                Account Security & Password Change
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Real-time Firebase Auth Update</span>
            </div>

            {passwordUpdateMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                passwordUpdateMsg.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                {passwordUpdateMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                <span>{passwordUpdateMsg.message}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">New Password <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium focus:outline-hidden focus:border-rose-500 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Confirm New Password <span className="text-rose-500">*</span></label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium focus:outline-hidden focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-400">Password Strength:</span>
                    <span className={
                      newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'text-emerald-400' :
                      newPassword.length >= 6 ? 'text-amber-400' : 'text-rose-400'
                    }>
                      {newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'Strong 🟢' :
                       newPassword.length >= 6 ? 'Medium 🟡' : 'Weak 🔴'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden flex">
                    <div className={`h-full transition-all duration-300 ${
                      newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'w-full bg-emerald-500' :
                      newPassword.length >= 6 ? 'w-2/3 bg-amber-500' : 'w-1/3 bg-rose-500'
                    }`} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Passwords do not match
                  </span>
                )}
                {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 6 && (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </span>
                )}
                <div className="w-full sm:w-auto ml-auto pt-2 sm:pt-0">
                  <button
                    type="submit"
                    disabled={isUpdatingPass}
                    className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-rose-900/30 disabled:opacity-50"
                  >
                    {isUpdatingPass ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Lock className="w-4 h-4 text-white" />}
                    <span>{isUpdatingPass ? 'Updating Password...' : 'Update Account Password'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Biometric Consent Modal */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        onConsent={() => {
          localStorage.setItem('kss_biometric_consent', 'true');
          setIsConsentModalOpen(false);
          setIsFaceModalOpen(true);
        }}
        onDecline={() => {
          setIsConsentModalOpen(false);
          executeCheckInProcess();
        }}
      />

      {/* Face Capture Verification Modal */}
      <FaceCaptureModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        onSuccess={() => {
          executeCheckInProcess();
        }}
        employeeName={activeEmployee.fullName}
        employeeId={activeEmployee.id}
        profilePhotoUrl={activeEmployee.profilePhotoUrl}
        cloudDescriptor={activeEmployee.faceDescriptor}
      />

      {/* Diagnostic Facial Recognition Accuracy Test Modal (Zero Shift / Attendance Impact) */}
      <FaceCaptureModal
        isOpen={isTestFaceModalOpen}
        onClose={() => setIsTestFaceModalOpen(false)}
        onSuccess={() => {
          triggerHaptic('success');
          setActionFeedback({ success: true, message: '✓ Live Facial Recognition Accuracy Test Passed (95%+ Confidence)' });
          setTimeout(() => setActionFeedback(null), 3000);
        }}
        employeeName={activeEmployee.fullName}
        employeeId={activeEmployee.id}
        cloudDescriptor={activeEmployee.faceDescriptor}
        isTestMode={true}
      />

      {/* Explicit Biometric Face Registration Modal */}
      <FaceCaptureModal
        isOpen={isEnrollFaceModalOpen}
        onClose={() => setIsEnrollFaceModalOpen(false)}
        onSuccess={() => {
          executeCheckInProcess();
        }}
        onEnrollSuccess={(descriptorArray) => {
          triggerHaptic('success');
          updateEmployee(activeEmployee.id, {
            isFaceEnrolled: true,
            faceEnrolledAt: new Date().toISOString(),
            faceDescriptor: descriptorArray
          });
          setActionFeedback({ success: true, message: '✓ Face Biometric Template Successfully Enrolled & Synced to Cloud DB!' });
          setTimeout(() => setActionFeedback(null), 3500);
        }}
        employeeName={activeEmployee.fullName}
        employeeId={activeEmployee.id}
        profilePhotoUrl={activeEmployee.profilePhotoUrl}
        cloudDescriptor={activeEmployee.faceDescriptor}
        isEnrollmentMode={true}
      />

    </div>
  );
};
