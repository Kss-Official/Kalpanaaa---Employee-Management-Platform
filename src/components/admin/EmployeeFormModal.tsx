import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, EmploymentType, EmployeeStatus, UserRole } from '../../types';
import { X, Save, User, Briefcase, MapPin, Shield, ChevronRight, ChevronLeft, Check, Upload, Key, FileText } from 'lucide-react';

interface EmployeeFormModalProps {
  employeeToEdit?: Employee | null;
  onClose: () => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  employeeToEdit,
  onClose
}) => {
  const { addEmployee, updateEmployee, employees, sendPasswordReset, setEmployeeInitialPassword } = useAuth();
  const [resetSent, setResetSent] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const isEdit = Boolean(employeeToEdit);

  // A resume already exists for this employee, either still inline on the record or
  // relocated to employees/{id}/private/resume (flagged by hasResume). Drives both
  // the required-field check and the "already on file" hint, so an admin editing an
  // unrelated field is never asked to re-upload a document that is already stored.
  const hasStoredResume = Boolean(employeeToEdit?.resumeUrl) || Boolean(employeeToEdit?.hasResume);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: employeeToEdit?.employeeId || (() => {
      let maxSeq = 2; 
      employees.forEach(emp => {
        if (emp.employeeId) {
          const cleanId = emp.employeeId.replace(/^(KSS2407|KSS2707|KSS24|KSS)/i, '');
          const numMatch = cleanId.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            if (!isNaN(num) && num < 10000 && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      });
      return `KSS2407${String(maxSeq + 1).padStart(3, '0')}`;
    })(),
    fullName: employeeToEdit?.fullName || '',
    email: employeeToEdit?.email || '',
    phone: employeeToEdit?.phone || '',
    gender: employeeToEdit?.gender || 'Male',
    dateOfBirth: employeeToEdit?.dateOfBirth || '1995-01-01',
    profilePhotoUrl: employeeToEdit?.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    department: employeeToEdit?.department || 'Engineering',
    designation: employeeToEdit?.designation || 'Software Engineer',
    joiningDate: employeeToEdit?.joiningDate || new Date().toISOString().split('T')[0],
    employmentType: employeeToEdit?.employmentType || ('Full-Time' as EmploymentType),
    reportingManager: employeeToEdit?.reportingManager || 'Rahul Sharma',
    workLocation: employeeToEdit?.workLocation || 'Kalpanaaa Headquarters',
    status: employeeToEdit?.status || ('Active' as EmployeeStatus),
    shift: employeeToEdit?.shift || 'Day Shift (10:00 AM – 7:00 PM)',
    permanentAddress: employeeToEdit?.permanentAddress || 'Hitech City Road',
    currentAddress: employeeToEdit?.currentAddress || 'Hitech City Road',
    city: employeeToEdit?.city || 'Hyderabad',
    state: employeeToEdit?.state || 'Telangana',
    postalCode: employeeToEdit?.postalCode || '500081',
    emergencyContact: employeeToEdit?.emergencyContact || '+91 98765 00000',
    emergencyRelationship: employeeToEdit?.emergencyRelationship || 'Parent',
    role: employeeToEdit?.role || ('EMPLOYEE' as UserRole),
    resumeUrl: employeeToEdit?.resumeUrl || '',
    approvedWfhDates: employeeToEdit?.approvedWfhDates || [],
    password: '',
  });

  const [sameAsPermanentAddress, setSameAsPermanentAddress] = useState(
    employeeToEdit ? (employeeToEdit.currentAddress === employeeToEdit.permanentAddress) : false
  );
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'approvedWfhDates') {
      const dates = e.target.value.split(',').map(d => d.trim()).filter(d => d);
      setFormData(prev => ({ ...prev, approvedWfhDates: dates }));
    } else {
      setFormData(prev => {
        const newData = { ...prev, [e.target.name]: e.target.value };
        if (!isEdit && e.target.name === 'designation') {
          if (['Chief Executive Officer (CEO)', 'Chief Technology Officer (CTO)'].includes(e.target.value)) {
            newData.role = 'SUPER_ADMIN';
          } else if (e.target.value === 'Project Manager') {
            newData.role = 'PROJECT_MANAGER';
          } else if (e.target.value.includes('HR')) {
            newData.role = 'HR_ADMIN';
          } else {
            newData.role = 'EMPLOYEE';
          }
        }
        return newData;
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'profilePhotoUrl' | 'resumeUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fieldName === 'profilePhotoUrl') {
      try {
        const { compressImageBase64 } = await import('../../lib/imageUtils');
        const compressedBase64 = await compressImageBase64(file, 400, 400, 0.7);
        setFormData(prev => ({ ...prev, [fieldName]: compressedBase64 }));
        return;
      } catch (err) {
        console.error('Image compression failed:', err);
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormData(prev => ({ ...prev, [fieldName]: event.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setErrorMsg('Please complete Full Name, Company Email, and Mobile Phone.');
      return false;
    }
    const cleanEmail = formData.email.trim().toLowerCase();
    const isValidCompanyEmail = 
      cleanEmail.endsWith('@kalpanaaa.in') || 
      cleanEmail.endsWith('@kalpanaaasoftwaresolutions.in') || 
      cleanEmail.endsWith('@kalpanaaasoftwaresoutions.in');

    if (!isValidCompanyEmail) {
      setErrorMsg('Employee email must end with @kalpanaaa.in or @kalpanaaasoftwaresolutions.in');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep2 = () => {
    if (!formData.employeeId.trim() || !formData.designation.trim() || !formData.department.trim()) {
      setErrorMsg('Please provide Employee ID, Designation, and Department.');
      return false;
    }
    if (!isEdit && (!formData.password || formData.password.length < 6)) {
      setErrorMsg('Initial password must be at least 6 characters.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    setErrorMsg('');
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as any);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validateStep1() || !validateStep2()) return;

    // The resume requirement is satisfied either by a blob in this form or by one
    // already stored. Since the resume moved to employees/{id}/private/resume the
    // parent record no longer carries resumeUrl — checking only formData.resumeUrl
    // would have blocked EVERY edit of an already-migrated employee (department,
    // shift, password reset, anything) with a bogus "please upload" error.
    if (!formData.profilePhotoUrl || !(formData.resumeUrl || hasStoredResume)) {
      setErrorMsg('Please upload both Profile Photo and Resume document.');
      return;
    }

    if (isEdit && employeeToEdit) {
      await updateEmployee(employeeToEdit.id, formData);
      if (formData.password && formData.password.trim().length >= 6) {
        const passRes = await setEmployeeInitialPassword(formData.email, formData.password);
        if (!passRes.success) {
          setErrorMsg(`Profile updated, but password failed: ${passRes.message}`);
          return;
        }
      }
    } else {
      const res = await addEmployee(formData as any);
      if (res && res.success === false) {
        setErrorMsg(res.message);
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden text-white max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{isEdit ? 'Edit Employee Profile' : 'HR Employee Onboarding Wizard'}</h2>
              <p className="text-xs text-slate-400">Enterprise HRMS Directory Entry • Step {currentStep} of 3</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Progress Indicator */}
        <div className="bg-slate-950/60 border-b border-slate-800 px-4 sm:px-8 py-3 shrink-0">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === 1 ? 'bg-blue-600 text-white shadow-md' : currentStep > 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-xs font-semibold ${currentStep === 1 ? 'text-white font-bold' : 'text-slate-400'}`}>
                Personal Info
              </span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-800 mx-3" />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === 2 ? 'bg-blue-600 text-white shadow-md' : currentStep > 2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`text-xs font-semibold ${currentStep === 2 ? 'text-white font-bold' : 'text-slate-400'}`}>
                Job & Role
              </span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-800 mx-3" />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === 3 ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400'
              }`}>
                3
              </div>
              <span className={`text-xs font-semibold ${currentStep === 3 ? 'text-white font-bold' : 'text-slate-400'}`}>
                Address & Docs
              </span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto text-xs bg-slate-900 flex-1">
            {errorMsg && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {/* STEP 1: Personal Details */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="font-bold uppercase tracking-wider text-[11px] text-blue-400 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-400" /> 1. Personal & Basic Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Full Legal Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Gaurav Kumar Tripathi"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Company Email <span className="text-rose-500">*</span></label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="name@kalpanaaa.in"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                    {!isEdit && (
                      <p className="text-[10px] text-slate-500 mt-1">Must end with @kalpanaaa.in or @kalpanaaasoftwaresolutions.in</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Mobile Phone <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-Binary">Non-Binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Date of Birth <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Profile Photo <span className="text-rose-500">*</span></label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileChange(e, 'profilePhotoUrl')}
                      className="w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Employment, Job & Credentials */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="font-bold uppercase tracking-wider text-[11px] text-blue-400 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-blue-400" /> 2. Employment, Job & Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Employee ID <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Designation <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Senior Frontend Developer"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Department <span className="text-rose-500">*</span></label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="HR & Operations">HR & Operations</option>
                      <option value="Project Management">Project Management</option>
                      <option value="Product Design">Product Design</option>
                      <option value="Quality Assurance">Quality Assurance</option>
                      <option value="Executive Board">Executive Board</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Official Joining Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="joiningDate"
                      value={formData.joiningDate}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Days before this date will be unmarked (not counted as absent).</p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Shift Schedule</label>
                    <input
                      type="text"
                      name="shift"
                      value={formData.shift}
                      onChange={handleChange}
                      placeholder="Day Shift (10:00 AM – 7:00 PM)"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">System User Role</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-bold"
                    >
                      <option value="EMPLOYEE">Standard Employee</option>
                      <option value="PROJECT_MANAGER">Project Manager</option>
                      <option value="HR_ADMIN">HR Administrator</option>
                      <option value="SUPER_ADMIN">Executive Board (CEO/CTO)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Employment Status</label>
                    <select
                      name="status"
                      value={formData.status || 'Active'}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-bold"
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      {isEdit ? 'Set New Password (Optional)' : 'Initial Account Password'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={isEdit ? 'Leave blank to keep current' : 'Min 6 characters'}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Address, Emergency & Resume */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1">
                  <h3 className="font-bold uppercase tracking-wider text-[11px] text-blue-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-400" /> 3. Address, Emergency Contacts & Docs
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-blue-400 hover:text-blue-300 transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={sameAsPermanentAddress}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSameAsPermanentAddress(checked);
                        if (checked) {
                          setFormData(prev => ({ ...prev, currentAddress: prev.permanentAddress }));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>SAME AS PERMANENT</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Permanent Address</label>
                    <input
                      type="text"
                      name="permanentAddress"
                      value={formData.permanentAddress}
                      onChange={e => {
                        handleChange(e);
                        if (sameAsPermanentAddress) {
                          setFormData(prev => ({ ...prev, currentAddress: e.target.value }));
                        }
                      }}
                      placeholder="Enter permanent residential address"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Current Address</label>
                    <input
                      type="text"
                      name="currentAddress"
                      value={formData.currentAddress}
                      onChange={e => {
                        handleChange(e);
                        if (sameAsPermanentAddress && e.target.value !== formData.permanentAddress) {
                          setSameAsPermanentAddress(false);
                        }
                      }}
                      placeholder="Enter current address"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">City / State / Postal</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="City"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="State"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="+91 98765 00000"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Emergency Relationship</label>
                    <input
                      type="text"
                      name="emergencyRelationship"
                      value={formData.emergencyRelationship}
                      onChange={handleChange}
                      placeholder="Spouse / Parent / Sibling"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">Upload Resume Document (PDF / Image) <span className="text-rose-500">*</span></label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={e => handleFileChange(e, 'resumeUrl')}
                      className="w-full text-[11px] text-slate-400 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                    />
                    {/* The input cannot show a pre-existing file, and the resume blob
                        now lives in employees/{id}/private/resume rather than on the
                        record, so without this the field looked empty on every edit
                        and the asterisk implied a re-upload was required. */}
                    {Boolean(formData.resumeUrl || employeeToEdit?.resumeUrl) && (
                      <p className="mt-1.5 text-[11px] text-emerald-400 font-semibold">
                        ✓ A resume is already on file — leave this empty to keep it, or choose a file to replace it.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions - Dedicated Fixed Bottom Footer Bar */}
          <div className="bg-slate-950 border-t border-slate-800 p-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous Step
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-900/40 cursor-pointer transition-all"
              >
                <span>Next Step</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-900/40 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isEdit ? 'Save Employee Profile' : 'Complete Employee Onboarding'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
