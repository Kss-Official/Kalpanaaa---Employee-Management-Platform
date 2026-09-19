import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  User, 
  LogIn, 
  LogOut, 
  Coffee, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  CreditCard, 
  Building2, 
  Mail, 
  Phone,
  Sparkles,
  AlertTriangle,
  Send,
  X,
  Camera,
  Upload,
  Trash2,
  Plus,
  Save,
  Edit3,
  Globe,
  UtensilsCrossed,
  Users,
  GraduationCap,
  Zap,
  StopCircle,
  Loader2,
  Check,
  ScanFace,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { BreakType, Employee } from '../../types';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { EmployeeIdCardModal } from '../admin/EmployeeIdCardModal';
import { FaceCaptureModal } from '../shared/LazyFaceCaptureModal';
import { useHaptic } from '../../hooks/useHaptic';
import { 
  getEmployeeWorkDate, 
  resolveAttendanceRecord, 
  safeGetTimestampMillis, 
  isShiftComplete, 
  isApprovedWfhForEmployee,
  SHIFT_LABEL,
  SHIFT_TOTAL_MINUTES
} from '../../lib/attendanceEngine';
import { toISTTimeString, todayInIST } from '../../lib/absoluteTime';
import { compressImageBase64 } from '../../lib/imageUtils';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
];

interface PMProfileViewProps {
  onOpenIdCard?: (emp: Employee) => void;
}

export const PMProfileView: React.FC<PMProfileViewProps> = ({ onOpenIdCard }) => {
  const { triggerHaptic } = useHaptic();
  const { 
    activeEmployee, 
    employees,
    attendance, 
    leaveRequests, 
    companyWideWfhDates,
    checkIn, 
    checkOut, 
    startBreak, 
    endBreak, 
    submitLeaveRequest,
    settings,
    updateEmployee
  } = useAuth();

  // Active PM fallback
  const targetEmployee = activeEmployee || employees.find(e => 
    e.role === 'PROJECT_MANAGER' || 
    (e.designation || '').toLowerCase().includes('project manager') ||
    (e.department || '').toLowerCase().includes('project')
  ) || employees[0];

  // Active Sub-view Tab: 'overview' | 'settings' | 'leave'
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'leave'>('overview');

  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInternalIdCard, setShowInternalIdCard] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isEnrollFaceModalOpen, setIsEnrollFaceModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBreakActionLoading, setIsBreakActionLoading] = useState(false);

  // Today's attendance calculation
  const todayStr = getEmployeeWorkDate(new Date());
  const myTodayRecord = targetEmployee 
    ? resolveAttendanceRecord(attendance, targetEmployee, todayStr) ?? null
    : null;

  const pmShiftComplete = isShiftComplete(myTodayRecord);
  const isCheckedIn = !!myTodayRecord?.checkInAt && !pmShiftComplete;
  const activeBreak = myTodayRecord?.breaks?.find(b => !b.endAt && !(b as any).endTime);

  // Live Timer for Working Hours
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const startMs = safeGetTimestampMillis(myTodayRecord?.checkInAt);
    if (isCheckedIn && startMs) {
      const calculateSeconds = () => {
        const now = Date.now();
        const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000));
        setWorkingSeconds(diffSecs);

        if (activeBreak) {
          const breakStartMs = safeGetTimestampMillis(activeBreak.startAt || (activeBreak as any).startTime);
          if (breakStartMs) {
            setBreakElapsedSeconds(Math.max(0, Math.floor((now - breakStartMs) / 1000)));
          }
        } else {
          setBreakElapsedSeconds(0);
        }
      };
      calculateSeconds();
      interval = setInterval(calculateSeconds, 1000);
    } else {
      setWorkingSeconds(0);
      setBreakElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, myTodayRecord?.checkInAt, activeBreak]);

  // ══════════════════════════════════════════════════════════════
  // PROFILE SETTINGS FORM STATE
  // ══════════════════════════════════════════════════════════════
  const [fullName, setFullName] = useState(targetEmployee?.fullName || '');
  const [phone, setPhone] = useState(targetEmployee?.phone || '');
  const [gender, setGender] = useState(targetEmployee?.gender || 'Prefer not to say');
  const [dateOfBirth, setDateOfBirth] = useState(targetEmployee?.dateOfBirth || '');
  const [profilePhoto, setProfilePhoto] = useState(targetEmployee?.profilePhotoUrl || '');
  const [permanentAddress, setPermanentAddress] = useState(targetEmployee?.permanentAddress || '');
  const [currentAddress, setCurrentAddress] = useState(targetEmployee?.currentAddress || '');
  const [sameAsPermanentAddress, setSameAsPermanentAddress] = useState(false);
  const [city, setCity] = useState(targetEmployee?.city || '');
  const [state, setState] = useState(targetEmployee?.state || '');
  const [postalCode, setPostalCode] = useState(targetEmployee?.postalCode || '');
  const [emergencyContact, setEmergencyContact] = useState(targetEmployee?.emergencyContact || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(targetEmployee?.emergencyRelationship || '');
  const [bio, setBio] = useState(targetEmployee?.bio || '');
  const [skills, setSkills] = useState<string[]>(targetEmployee?.skills || ['Agile Scrum', 'Sprint Planning', 'Team Leadership', 'JIRA / GitHub']);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState(targetEmployee?.linkedinUrl || '');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedSuccess, setProfileSavedSuccess] = useState(false);
  const [isCapturingWebcam, setIsCapturingWebcam] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync profile form when targetEmployee changes
  useEffect(() => {
    if (targetEmployee) {
      setFullName(targetEmployee.fullName || '');
      setPhone(targetEmployee.phone || '');
      setGender(targetEmployee.gender || 'Prefer not to say');
      setDateOfBirth(targetEmployee.dateOfBirth || '');
      setProfilePhoto(targetEmployee.profilePhotoUrl || '');
      setPermanentAddress(targetEmployee.permanentAddress || '');
      setCurrentAddress(targetEmployee.currentAddress || '');
      setCity(targetEmployee.city || '');
      setState(targetEmployee.state || '');
      setPostalCode(targetEmployee.postalCode || '');
      setEmergencyContact(targetEmployee.emergencyContact || '');
      setEmergencyRelationship(targetEmployee.emergencyRelationship || '');
      setBio(targetEmployee.bio || '');
      setSkills(targetEmployee.skills || ['Agile Scrum', 'Sprint Planning', 'Team Leadership', 'JIRA / GitHub']);
      setLinkedinUrl(targetEmployee.linkedinUrl || '');
    }
  }, [targetEmployee]);

  // Handle Photo File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageBase64(file, 400, 400, 0.7);
        setProfilePhoto(compressedBase64);
        toast.success('Profile photo uploaded and compressed.');
      } catch (err) {
        console.error('Image compression failed:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setProfilePhoto(reader.result);
            toast.success('Profile photo loaded.');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Live Webcam Photo Snapshot
  const handleWebcamPhotoCapture = async () => {
    setIsCapturingWebcam(true);
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        await new Promise(r => setTimeout(r, 350)); // let camera sensor auto-expose

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const realPhotoUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePhoto(realPhotoUrl);
          toast.success('📸 Webcam snapshot captured successfully!');
        }
        video.srcObject = null;
      } else {
        setIsEnrollFaceModalOpen(true);
      }
    } catch (err) {
      console.warn('[PMProfileView] Webcam direct stream error:', err);
      setIsEnrollFaceModalOpen(true);
    } finally {
      if (stream) stream.getTracks().forEach(t => t.stop());
      setIsCapturingWebcam(false);
    }
  };

  const handleAddSkill = () => {
    const clean = newSkillInput.trim();
    if (clean && !skills.includes(clean)) {
      setSkills([...skills, clean]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSameAsPermanentToggle = (checked: boolean) => {
    setSameAsPermanentAddress(checked);
    if (checked) {
      setCurrentAddress(permanentAddress);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // SUBMIT & SAVE PROFILE DETAILS
  // ══════════════════════════════════════════════════════════════
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee) return;

    setIsSavingProfile(true);
    triggerHaptic('medium');
    try {
      const updates: Partial<Employee> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender: gender as any,
        dateOfBirth,
        profilePhotoUrl: profilePhoto,
        permanentAddress: permanentAddress.trim(),
        currentAddress: currentAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        emergencyContact: emergencyContact.trim(),
        emergencyRelationship: emergencyRelationship.trim(),
        bio: bio.trim(),
        skills,
        linkedinUrl: linkedinUrl.trim()
      };

      await updateEmployee(targetEmployee.id, updates);
      triggerHaptic('success');
      setProfileSavedSuccess(true);
      toast.success('✓ PM profile details saved & synchronized to cloud database!');
      setTimeout(() => setProfileSavedSuccess(false), 3500);
    } catch (err: any) {
      triggerHaptic('error');
      console.error('[PMProfileView] Profile save error:', err);
      toast.error(`Failed to save profile: ${err?.message || 'Database error'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // DUTY & ATTENDANCE ACTIONS
  // ══════════════════════════════════════════════════════════════
  const getFixOrNull = (): Promise<{ lat: number; lon: number; accuracy: number } | null> =>
    new Promise(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy) || 10,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    });

  const executePmCheckInProcess = async () => {
    if (!targetEmployee) return;
    setLoading(true);

    const isWfhApproved = isApprovedWfhForEmployee(targetEmployee, getEmployeeWorkDate(new Date()), {
      leaveRequests,
      companyWideWfhDates,
      settings
    });
    const geofenceOn = settings.gpsRequired !== false && !isWfhApproved;

    let fix: { lat: number; lon: number; accuracy: number } | null = null;
    if (geofenceOn) {
      fix = await getFixOrNull();
      if (!fix) {
        toast.error('Location Permission Required: please allow location access to check in at office.');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await checkIn(targetEmployee.id, fix?.lat, fix?.lon, fix?.accuracy, 'Facial Recognition');
      if (res.success) {
        toast.success(res.message || 'PM Duty Check-In recorded via Face Biometrics!');
      } else {
        toast.error(res.message || 'Check-In failed.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePmCheckOut = async () => {
    if (!targetEmployee) return;
    if (!confirm('Are you sure you want to end your shift and check out for today?')) return;
    setLoading(true);

    const fix = settings.gpsRequired !== false ? await getFixOrNull() : null;
    try {
      const res = await checkOut(targetEmployee.id, fix?.lat, fix?.lon, fix?.accuracy);
      if (res.success) {
        toast.success(res.message || 'Shift completed! PM Check-Out recorded.');
      } else {
        toast.error(res.message || 'Check-Out failed.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-Out failed.');
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // DISTINCT CLEAR BREAK ACTIONS
  // ══════════════════════════════════════════════════════════════
  const handleStartBreak = async (breakType: BreakType | string) => {
    if (!targetEmployee) return;
    if (!isCheckedIn) {
      toast.error('Please Check In first to start a break.');
      return;
    }
    setIsBreakActionLoading(true);
    triggerHaptic('medium');

    try {
      const fix = await getFixOrNull();
      const res = await startBreak(targetEmployee.id, breakType, fix?.lat, fix?.lon);
      if (res.success) {
        triggerHaptic('success');
        toast.success(res.message || `${breakType} started! Remember to clear break when you return.`);
      } else {
        triggerHaptic('error');
        toast.error(res.message || 'Failed to start break.');
      }
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err?.message || 'Break action failed.');
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!targetEmployee) return;
    setIsBreakActionLoading(true);
    triggerHaptic('medium');

    try {
      const fix = await getFixOrNull();
      const res = await endBreak(targetEmployee.id, fix?.lat, fix?.lon);
      if (res.success) {
        triggerHaptic('success');
        toast.success(res.message || 'Break cleared! Resumed active duty. 👋');
      } else {
        triggerHaptic('error');
        toast.error(res.message || 'Failed to clear break.');
      }
    } catch (err: any) {
      triggerHaptic('error');
      toast.error(err?.message || 'Failed to clear break.');
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // LEAVE / WFH FORM STATE
  // ══════════════════════════════════════════════════════════════
  const [reqType, setReqType] = useState<'WFH' | 'Leave'>('WFH');
  const [startDate, setStartDate] = useState(getEmployeeWorkDate(new Date()));
  const [endDate, setEndDate] = useState(getEmployeeWorkDate(new Date()));
  const [reason, setReason] = useState('');
  const [logFilter, setLogFilter] = useState<'All' | 'Today' | 'Upcoming' | 'Previous' | 'Approved' | 'Rejected'>('All');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !reason.trim()) return;

    submitLeaveRequest({
      employeeId: targetEmployee.employeeId || targetEmployee.id,
      employeeName: targetEmployee.fullName,
      department: targetEmployee.department || 'Engineering & Product',
      type: reqType,
      startDate,
      endDate,
      reason
    });

    toast.success('Request submitted successfully to Executive Management!');
    setReason('');
  };

  const myLeaveRequests = leaveRequests.filter(r => 
    r.employeeId === activeEmployee?.id || 
    r.employeeId === activeEmployee?.employeeId || 
    r.employeeName === activeEmployee?.fullName
  );

  const filteredPersonalRequests = myLeaveRequests.filter(req => {
    if (logFilter === 'All') return true;
    if (logFilter === 'Today') {
      const isActiveToday = req.startDate <= todayStr && req.endDate >= todayStr;
      const isSubmittedToday = req.requestDate?.startsWith(todayStr);
      return isActiveToday || isSubmittedToday;
    }
    if (logFilter === 'Upcoming') return req.startDate > todayStr;
    if (logFilter === 'Previous') return req.endDate < todayStr || req.status === 'Approved' || req.status === 'Rejected';
    if (logFilter === 'Approved') return req.status === 'Approved';
    if (logFilter === 'Rejected') return req.status === 'Rejected';
    return true;
  });

  // Calculate live worked time vs break time
  const activeBreakStart = activeBreak ? (activeBreak.startAt || (activeBreak as any).startTime) : null;
  const currentBreakMins = activeBreakStart 
    ? Math.max(0, Math.floor((Date.now() - new Date(activeBreakStart).getTime()) / 60000))
    : 0;
  const totalBreakMins = (myTodayRecord?.totalBreakMinutes || 0) + currentBreakMins;
  const totalWorkedSecs = Math.max(0, workingSeconds - (totalBreakMins * 60));
  const targetShiftSecs = (SHIFT_TOTAL_MINUTES || 540) * 60;
  const shiftProgressPercent = Math.min(100, Math.round((totalWorkedSecs / targetShiftSecs) * 100));

  const formatHms = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const formatMs = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 max-w-7xl mx-auto">
      
      {/* ── TOP BANNER & PM IDENTITY OVERVIEW ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src={profilePhoto || targetEmployee?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetEmployee?.fullName || 'PM')}&background=0f172a&color=fff`}
                alt={targetEmployee?.fullName || 'Project Manager'}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500/40 shadow-xl shadow-amber-950/40 shrink-0"
              />
              <span className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                activeBreak
                  ? 'bg-amber-400 animate-pulse'
                  : isCheckedIn
                    ? 'bg-emerald-400'
                    : pmShiftComplete
                      ? 'bg-blue-400'
                      : 'bg-slate-500'
              }`} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-white">{targetEmployee?.fullName || 'Project Manager'}</h1>
                <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                  {targetEmployee?.employeeId || 'KSS-PM-01'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {targetEmployee?.designation || 'Project Manager'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {targetEmployee?.department || 'Engineering & Product'} • Shift: <strong className="text-slate-300">{SHIFT_LABEL}</strong>
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> {targetEmployee?.email || 'pm@kalpanaaa.com'}</span>
                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> {targetEmployee?.phone || '+91 98765 43210'}</span>
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-500" /> Kalpanaaa HQ, Bengaluru</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                triggerHaptic();
                setActiveTab(activeTab === 'settings' ? 'overview' : 'settings');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md ${
                activeTab === 'settings'
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 hover:bg-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{activeTab === 'settings' ? 'Close Settings' : 'Edit Profile Settings'}</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic();
                setShowHistoryModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-md"
            >
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>30-Day Ledger</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic();
                if (onOpenIdCard && targetEmployee) {
                  onOpenIdCard(targetEmployee);
                } else {
                  setShowInternalIdCard(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-md"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Official ID Card</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Duty Command &amp; Clear Breaks</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Profile Settings Details</span>
          </button>

          <button
            onClick={() => setActiveTab('leave')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'leave'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>My Leave &amp; WFH</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: DUTY COMMAND CENTER & CLEAR BREAK BUTTONS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Active Break Alert Banner (When on break) */}
          <AnimatePresence>
            {activeBreak && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <Coffee className="w-7 h-7 text-amber-400 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-widest font-black text-amber-400">CURRENTLY ON BREAK</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    </div>
                    <h3 className="text-xl font-black text-white mt-0.5">
                      {activeBreak.type} <span className="text-amber-400 font-mono font-bold text-lg">({formatMs(breakElapsedSeconds)})</span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Break started at {toISTTimeString(activeBreak.startAt || (activeBreak as any).startTime)}. Click below when you are ready to resume your shift.
                    </p>
                  </div>
                </div>

                {/* CLEAR BREAK BUTTON */}
                <button
                  onClick={handleEndBreak}
                  disabled={isBreakActionLoading}
                  className="w-full md:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-950/50 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.03] cursor-pointer disabled:opacity-50"
                >
                  {isBreakActionLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-950" /> : <StopCircle className="w-5 h-5 text-slate-950" />}
                  <span>Clear Break / End Break (Resume Shift)</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personal Duty Command Center Cards */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  PM Personal Duty &amp; Attendance Command Center
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage your daily shift status, lunch/tea breaks, team meetings, huddles, and GPS verified check-ins.
                </p>
              </div>

              {/* Duty indicator badge */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                  activeBreak
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : isCheckedIn
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : pmShiftComplete
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    activeBreak ? 'bg-amber-400 animate-ping' : isCheckedIn ? 'bg-emerald-400' : pmShiftComplete ? 'bg-blue-400' : 'bg-slate-500'
                  }`} />
                  <span>
                    {activeBreak ? `On Break (${activeBreak.type})` : isCheckedIn ? 'On Duty (Active)' : pmShiftComplete ? 'Shift Completed' : 'Not Checked In'}
                  </span>
                </span>
              </div>
            </div>

            {/* 3 Main Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Card 1: Shift Check-In */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                isCheckedIn 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SHIFT CHECK-IN</span>
                  <h3 className="text-xl font-black text-white">
                    {isCheckedIn ? `Checked In • ${toISTTimeString(myTodayRecord?.checkInAt!)}` : 'Check-In'}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isCheckedIn ? 'Active shift in progress with verified GPS & Biometrics.' : 'Initialize shift attendance with Facial Biometrics & GPS check-in.'}
                  </p>
                </div>

                {!isCheckedIn ? (
                  <button
                    onClick={() => setIsFaceModalOpen(true)}
                    disabled={loading || pmShiftComplete}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{loading ? 'Verifying Face & GPS...' : 'Check In (Face Biometrics)'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/20 px-3 py-2.5 rounded-xl border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Verified ({myTodayRecord?.distanceFromOffice ?? 10}m from Office HQ)</span>
                  </div>
                )}
              </div>

              {/* Card 2: Shift End / Check-Out */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                pmShiftComplete
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SHIFT END</span>
                  <h3 className="text-xl font-black text-white">
                    {pmShiftComplete ? `Checked Out • ${toISTTimeString(myTodayRecord?.checkOutAt)}` : 'Check-Out'}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {pmShiftComplete ? 'Today\'s PM duty completed.' : 'Finalize today\'s total working duration and log shift summary.'}
                  </p>
                </div>

                <button
                  onClick={handlePmCheckOut}
                  disabled={loading || !isCheckedIn}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{pmShiftComplete ? 'Shift Finished' : 'Check Out (End Duty)'}</span>
                </button>
              </div>

              {/* Card 3: Live Work Summary */}
              <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">LIVE WORKED TIME</span>
                  <h3 className="text-xl font-mono font-black text-emerald-400">
                    {formatHms(totalWorkedSecs)}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Total breaks taken today: <strong className="text-amber-400">{totalBreakMins} mins</strong>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>Target 9h Shift Progress</span>
                    <span className="text-white">{shiftProgressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${shiftProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* ── DISTINCT CLEAR BREAK BUTTONS SECTION ── */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-400" />
                    Clear Break Selection &amp; Management
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Choose from distinct break categories: Team Meeting, Lunch Break, Team Huddle, Tea Break, Training, or Activity.
                  </p>
                </div>
                {activeBreak && (
                  <button
                    onClick={handleEndBreak}
                    disabled={isBreakActionLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>Clear Break Now</span>
                  </button>
                )}
              </div>

              {!isCheckedIn ? (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                  Please <strong>Check In</strong> to start your shift before activating any break categories.
                </div>
              ) : activeBreak ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-amber-400 font-bold uppercase">Break Currently Active</div>
                      <div className="text-sm font-black text-white">
                        {activeBreak.type} • Elapsed: <span className="font-mono text-amber-300">{formatMs(breakElapsedSeconds)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleEndBreak}
                    disabled={isBreakActionLoading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
                  >
                    <StopCircle className="w-4 h-4 text-slate-950" />
                    <span>Clear Active Break &amp; Return to Work</span>
                  </button>
                </div>
              ) : (
                /* GRID OF DISTINCT CLEAR BREAK BUTTONS */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  
                  {/* 1. Lunch Break Button */}
                  <button
                    onClick={() => handleStartBreak('Lunch Break')}
                    disabled={isBreakActionLoading}
                    className="p-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-105 shadow-md shadow-rose-950/30 disabled:opacity-50"
                  >
                    <span className="text-2xl">🍽️</span>
                    <span className="font-black text-white text-xs">Lunch Break</span>
                    <span className="text-[10px] text-rose-400 font-medium">Meal / Lunch</span>
                  </button>

                  {/* 2. Team Meeting Button */}
                  <button
                    onClick={() => handleStartBreak('Team Meeting')}
                    disabled={isBreakActionLoading}
                    className="p-3.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-xs rounded-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-105 shadow-md shadow-purple-950/30 disabled:opacity-50"
                  >
                    <span className="text-2xl">📅</span>
                    <span className="font-black text-white text-xs">Team Meeting</span>
                    <span className="text-[10px] text-purple-400 font-medium">Client / Sync</span>
                  </button>

                  {/* 3. Team Huddle Button */}
                  <button
                    onClick={() => handleStartBreak('Team Huddle')}
                    disabled={isBreakActionLoading}
                    className="p-3.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold text-xs rounded-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-105 shadow-md shadow-sky-950/30 disabled:opacity-50"
                  >
                    <span className="text-2xl">👥</span>
                    <span className="font-black text-white text-xs">Team Huddle</span>
                    <span className="text-[10px] text-sky-400 font-medium">Daily Standup</span>
                  </button>

                  {/* 4. Tea Break Button */}
                  <button
                    onClick={() => handleStartBreak('Tea Break')}
                    disabled={isBreakActionLoading}
                    className="p-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-105 shadow-md shadow-amber-950/30 disabled:opacity-50"
                  >
                    <span className="text-2xl">🍵</span>
                    <span className="font-black text-white text-xs">Tea Break</span>
                    <span className="text-[10px] text-amber-400 font-medium">Tea / Refresh</span>
                  </button>

                  {/* 5. Attainment / Training Button */}
                  <button
                    onClick={() => handleStartBreak('Attainment / Training')}
                    disabled={isBreakActionLoading}
                    className="p-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-105 shadow-md shadow-emerald-950/30 disabled:opacity-50"
                  >
                    <span className="text-2xl">🎓</span>
                    <span className="font-black text-white text-xs">Training</span>
                    <span className="text-[10px] text-emerald-400 font-medium">Upskilling / Prep</span>
                  </button>

                  {/* 6. Activity Button */}
                  <button
                    onClick={() => handleStartBreak('Activity')}
                    disabled={isBreakActionLoading}
                    className="p-3.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:scale-105 shadow-md shadow-cyan-950/30 disabled:opacity-50"
                  >
                    <span className="text-2xl">⚡</span>
                    <span className="font-black text-white text-xs">Activity</span>
                    <span className="text-[10px] text-cyan-400 font-medium">Internal Task</span>
                  </button>

                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: PM PROFILE SETTINGS DETAILS ENTRY & SAVE FORM
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 relative overflow-hidden"
        >
          {profileSavedSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-3 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="block text-sm font-bold text-white">Profile Details Saved!</strong>
                <span className="text-xs">Your PM profile settings have been successfully updated in Firestore cloud database.</span>
              </div>
            </div>
          )}

          <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                PM Profile Settings &amp; Personal Details
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter or update your personal contact info, residential address, emergency contacts, professional bio, and technical skills.
              </p>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-950/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Save className="w-4 h-4 text-slate-950" />}
              <span>{isSavingProfile ? 'Saving Changes...' : 'Save & Submit Details'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-8">
            
            {/* ── SECTION 1: PROFILE PHOTO & FACE BIOMETRICS ── */}
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-5">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Camera className="w-4 h-4" /> Profile Photo &amp; Biometric Verification
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <img
                    src={profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'PM')}&background=0f172a&color=fff`}
                    alt="Preview"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-amber-500/50 shadow-lg"
                  />
                  {profilePhoto && (
                    <button
                      type="button"
                      onClick={() => setProfilePhoto('')}
                      className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-500 cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Real Webcam Camera Photo Capture */}
                    <button
                      type="button"
                      onClick={handleWebcamPhotoCapture}
                      disabled={isCapturingWebcam}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-slate-700 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isCapturingWebcam ? 'Capturing Snapshot...' : '📸 Webcam Snapshot'}</span>
                    </button>

                    {/* File Upload Button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-slate-700 shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>Upload Photo File</span>
                    </button>

                    {/* Biometric Face Template Enrollment */}
                    <button
                      type="button"
                      onClick={() => setIsEnrollFaceModalOpen(true)}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span>Enroll Face Biometric Template</span>
                    </button>
                  </div>

                  {/* Preset Avatars */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-2">Or Choose a High-Res Preset Avatar:</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {AVATAR_PRESETS.map((preset, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setProfilePhoto(preset)}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                            profilePhoto === preset ? 'border-amber-500 scale-105 shadow-md shadow-amber-500/30' : 'border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <img src={preset} alt={`Avatar ${idx}`} className="w-10 h-10 object-cover" />
                          {profilePhoto === preset && (
                            <div className="absolute inset-0 bg-amber-600/30 flex items-center justify-center">
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

            {/* ── SECTION 2: PERSONAL DETAILS FORM ── */}
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <User className="w-4 h-4" /> Personal Information &amp; Contact Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Koushik D"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-hidden focus:border-amber-500 transition-colors cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-hidden focus:border-amber-500 transition-colors cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Designation (Official)</label>
                  <input
                    type="text"
                    value={targetEmployee?.designation || 'Project Manager'}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-slate-900/50 border border-slate-800/80 rounded-xl text-slate-400 font-medium text-xs cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Department (Official)</label>
                  <input
                    type="text"
                    value={targetEmployee?.department || 'Engineering & Product'}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-slate-900/50 border border-slate-800/80 rounded-xl text-slate-400 font-medium text-xs cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION 3: ADDRESS & EMERGENCY CONTACTS ── */}
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Residential Address &amp; Emergency Contacts
                </h3>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={sameAsPermanentAddress}
                    onChange={e => handleSameAsPermanentToggle(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>CURRENT SAME AS PERMANENT</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Permanent Residential Address</label>
                  <input
                    type="text"
                    value={permanentAddress}
                    onChange={e => {
                      const val = e.target.value;
                      setPermanentAddress(val);
                      if (sameAsPermanentAddress) setCurrentAddress(val);
                    }}
                    placeholder="Enter permanent address"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Current Residential Address</label>
                  <input
                    type="text"
                    value={currentAddress}
                    onChange={e => {
                      setCurrentAddress(e.target.value);
                      if (sameAsPermanentAddress && e.target.value !== permanentAddress) {
                        setSameAsPermanentAddress(false);
                      }
                    }}
                    placeholder="Enter current local address"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={e => setState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={e => setPostalCode(e.target.value)}
                      placeholder="560001"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={e => setEmergencyContact(e.target.value)}
                    placeholder="e.g. +91 98765 00000"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Emergency Relationship</label>
                  <input
                    type="text"
                    value={emergencyRelationship}
                    onChange={e => setEmergencyRelationship(e.target.value)}
                    placeholder="e.g. Spouse, Parent, Brother"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION 4: PROFESSIONAL BIO, SKILLS & LINKS ── */}
            <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Professional Bio, Skills &amp; Portfolio
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Professional Bio / Leadership Summary</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Describe your PM leadership background, focus areas, and sprint delivery experience..."
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Technical &amp; Management Skills</label>
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    {skills.map((skill, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold text-xs">
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-white cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3 h-3 text-amber-400 hover:text-rose-400" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add skill (e.g. Scrum Master, React, CI/CD)"
                      value={newSkillInput}
                      onChange={e => setNewSkillInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-amber-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-1 text-xs cursor-pointer border border-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">LinkedIn Profile / Professional URL</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={e => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── SUBMIT & SAVE BUTTON ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                Back to Duty Command
              </button>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xl shadow-amber-950/50 hover:scale-[1.02] disabled:opacity-50"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Saving to Cloud Database...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-slate-950" />
                    <span>Submit &amp; Save Profile Details</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 3: MY LEAVE & WFH REQUESTS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          
          {/* Request Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-400" />
                Submit Leave / Work From Home Request
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Submitted directly to Executive Management (CEO / CTO) for review and approval.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Request Type</label>
                  <select
                    value={reqType}
                    onChange={e => setReqType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
                  >
                    <option value="WFH">🏠 Work From Home (WFH)</option>
                    <option value="Leave">🌴 Personal Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">Reason / Justification *</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  required
                  placeholder="Provide brief context for executive review..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-950/40 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>

          {/* Request History Log */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">My Submitted Requests History</h3>
              
              <div className="flex flex-wrap items-center gap-1.5">
                {(['All', 'Today', 'Upcoming', 'Approved', 'Rejected'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logFilter === f 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredPersonalRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No leave or WFH requests found matching selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="pb-2.5">Type</th>
                      <th className="pb-2.5">Dates</th>
                      <th className="pb-2.5">Reason</th>
                      <th className="pb-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPersonalRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-bold text-white">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                            req.type === 'WFH' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {req.type}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-slate-300">{req.startDate} to {req.endDate}</td>
                        <td className="py-3 text-slate-300 max-w-xs truncate">{req.reason}</td>
                        <td className="py-3">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            req.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            req.status === 'Rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── MODALS ── */}

      {/* 1. Biometric Face Verification Modal for Check-In */}
      {targetEmployee && (
        <FaceCaptureModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          onSuccess={() => {
            setIsFaceModalOpen(false);
            executePmCheckInProcess();
          }}
          onEnrollSuccess={(descriptorArray) => {
            if (updateEmployee && targetEmployee) {
              updateEmployee(targetEmployee.id, {
                isFaceEnrolled: true,
                faceEnrolledAt: new Date().toISOString(),
                faceDescriptor: descriptorArray
              });
            }
          }}
          employeeName={targetEmployee.fullName}
          employeeId={targetEmployee.id}
          profilePhotoUrl={profilePhoto || targetEmployee.profilePhotoUrl}
          cloudDescriptor={targetEmployee.faceDescriptor}
        />
      )}

      {/* 2. Biometric Face Template Enrollment Modal */}
      {targetEmployee && (
        <FaceCaptureModal
          isOpen={isEnrollFaceModalOpen}
          onClose={() => setIsEnrollFaceModalOpen(false)}
          onSuccess={() => {
            setIsEnrollFaceModalOpen(false);
            toast.success('Face biometric template verified!');
          }}
          onEnrollSuccess={(descriptorArray) => {
            triggerHaptic('success');
            if (updateEmployee && targetEmployee) {
              updateEmployee(targetEmployee.id, {
                isFaceEnrolled: true,
                faceEnrolledAt: new Date().toISOString(),
                faceDescriptor: descriptorArray
              });
              toast.success('✓ Face biometric template successfully registered & enrolled!');
            }
            setIsEnrollFaceModalOpen(false);
          }}
          employeeName={targetEmployee.fullName}
          employeeId={targetEmployee.id}
          profilePhotoUrl={profilePhoto || targetEmployee.profilePhotoUrl}
          cloudDescriptor={targetEmployee.faceDescriptor}
        />
      )}

      {/* 3. 30-Day Monthly Attendance Ledger Modal */}
      {showHistoryModal && targetEmployee && (
        <EmployeeMonthlyAttendanceModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          employee={targetEmployee}
        />
      )}

      {/* 4. Internal ID Card Modal Fallback */}
      {showInternalIdCard && targetEmployee && (
        <EmployeeIdCardModal
          employee={targetEmployee}
          onClose={() => setShowInternalIdCard(false)}
        />
      )}

    </div>
  );
};
