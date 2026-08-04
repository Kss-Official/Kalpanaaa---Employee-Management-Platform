import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, EmploymentType, EmployeeStatus, UserRole } from '../../types';
import { X, Save, User, Briefcase, MapPin, Shield } from 'lucide-react';

interface EmployeeFormModalProps {
  employeeToEdit?: Employee | null;
  onClose: () => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  employeeToEdit,
  onClose
}) => {
  const { addEmployee, updateEmployee, employees } = useAuth();

  const isEdit = Boolean(employeeToEdit);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: employeeToEdit?.employeeId || (() => {
      let maxSeq = 0; 
      employees.forEach(emp => {
        if (emp.employeeId) {
          // Extract the numeric part at the end of the ID string (e.g., '003' -> 3, 'KSS004' -> 4)
          const numMatch = emp.employeeId.match(/\d+$/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      });
      // Fallback base to 3 if database is totally empty, else +1
      maxSeq = Math.max(maxSeq, 3);
      return String(maxSeq + 1).padStart(3, '0');
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
    workLocation: employeeToEdit?.workLocation || 'AGPS Nagar HQ Campus',
    status: employeeToEdit?.status || ('Active' as EmployeeStatus),
    shift: employeeToEdit?.shift || 'General Shift (09:00 - 18:00)',
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
  });

  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'approvedWfhDates') {
      const dates = e.target.value.split(',').map(d => d.trim()).filter(d => d);
      setFormData(prev => ({ ...prev, approvedWfhDates: dates }));
    } else {
      setFormData(prev => {
        const newData = { ...prev, [e.target.name]: e.target.value };
        if (e.target.name === 'designation') {
          if (['Chief Executive Officer (CEO)', 'Chief Technology Officer (CTO)', 'Project Manager'].includes(e.target.value)) {
            newData.role = 'SUPER_ADMIN';
          } else if (e.target.value === 'HR Manager') {
            newData.role = 'HR_ADMIN';
          } else {
            newData.role = 'EMPLOYEE';
          }
        }
        return newData;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'profilePhotoUrl' | 'resumeUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormData(prev => ({ ...prev, [fieldName]: event.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.employeeId.trim() || !formData.phone.trim() || !formData.profilePhotoUrl || !formData.resumeUrl) {
      setErrorMsg('Please fill in all mandatory fields, including Profile Photo and Resume.');
      return;
    }

    if (!formData.email.trim().toLowerCase().endsWith('@kalpanaaa.in')) {
      setErrorMsg('All employee emails strictly must end with @kalpanaaa.in');
      return;
    }

    if (isEdit && employeeToEdit) {
      updateEmployee(employeeToEdit.id, formData);
    } else {
      addEmployee(formData as any);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden my-8 text-white">
        {/* Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{isEdit ? 'Edit Employee Record' : 'Onboard New Employee'}</h2>
              <p className="text-xs text-slate-400">Enterprise HRMS Directory Entry</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs bg-slate-900">
          {errorMsg && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Identity */}
          <div className="space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-[11px] text-blue-400 border-b border-slate-800 pb-1">
              1. Basic & Contact Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Employee ID <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Koushik Kumar"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-semibold text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Official Email <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="e.g. user@company.hr"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Gender <span className="text-rose-500">*</span></label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Profile Image URL <span className="text-rose-500">*</span></label>
                <input
                  type="url"
                  name="profilePhotoUrl"
                  value={formData.profilePhotoUrl}
                  onChange={handleChange}
                  required
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Resume URL (PDF) <span className="text-rose-500">*</span></label>
                <input
                  type="url"
                  name="resumeUrl"
                  value={formData.resumeUrl}
                  onChange={handleChange}
                  required
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Employment */}
          <div className="space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-[11px] text-blue-400 border-b border-slate-800 pb-1">
              2. Employment & Role
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="UI/UX Department">UI/UX Department</option>
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="HR Department">HR Department</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Designation Role</label>
                <select
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="UI/UX Designer">UI/UX Designer</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Chief Executive Officer (CEO)">Chief Executive Officer (CEO)</option>
                  <option value="Chief Technology Officer (CTO)">Chief Technology Officer (CTO)</option>
                  <option value="HR Operations Manager">HR Operations Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Employment Type</label>
                <select
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Joining Date</label>
                <input
                  type="date"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reporting Manager</label>
                <input
                  type="text"
                  name="reportingManager"
                  value={formData.reportingManager}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {!['Chief Executive Officer (CEO)', 'Chief Technology Officer (CTO)', 'Project Manager'].includes(formData.designation) && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">System Role Access</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-bold text-purple-400 focus:outline-none focus:border-blue-500"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="HR_ADMIN">HR_ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Account Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Work Location</label>
                <input
                  type="text"
                  name="workLocation"
                  value={formData.workLocation}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Shift</label>
                <input
                  type="text"
                  name="shift"
                  value={formData.shift}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Approved WFH Dates (YYYY-MM-DD)</label>
                <input
                  type="text"
                  name="approvedWfhDates"
                  value={(formData.approvedWfhDates || []).join(', ')}
                  onChange={handleChange}
                  placeholder="e.g. 2026-08-01, 2026-08-02"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>

              {/* Address Fields */}
              <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Permanent Address <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="permanentAddress"
                    value={formData.permanentAddress}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 123 Main St, Apt 4"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Current Address <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="currentAddress"
                    value={formData.currentAddress}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 456 Tech Park Rd"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">City <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">State & Postal Code <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      required
                      placeholder="ZIP"
                      className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Emergency & Photo */}
          <div className="space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-[11px] text-blue-400 border-b border-slate-800 pb-1">
              3. Emergency Contact & Photo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Emergency Phone</label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Relationship</label>
                <input
                  type="text"
                  name="emergencyRelationship"
                  value={formData.emergencyRelationship}
                  onChange={handleChange}
                  placeholder="Spouse / Parent / Brother"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Profile Photo URL</label>
                <input
                  type="text"
                  name="profilePhotoUrl"
                  value={formData.profilePhotoUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
            >
              <Save className="w-4 h-4" />
              {isEdit ? 'Update Employee' : 'Create Employee Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
