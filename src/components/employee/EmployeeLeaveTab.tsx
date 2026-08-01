import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Check, X, Clock, CalendarDays, Plus, Send } from 'lucide-react';

export const EmployeeLeaveTab: React.FC = () => {
  const { activeEmployee, leaveRequests, submitLeaveRequest } = useAuth();
  
  const [type, setType] = useState<'Leave' | 'WFH'>('WFH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<{success: boolean; message: string} | null>(null);

  const myRequests = leaveRequests.filter(r => r.employeeId === activeEmployee?.employeeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      setFeedback({ success: false, message: 'Please fill out all fields.' });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setFeedback({ success: false, message: 'End date cannot be before start date.' });
      return;
    }

    submitLeaveRequest({
      employeeId: activeEmployee!.employeeId,
      employeeName: activeEmployee!.fullName,
      type,
      startDate,
      endDate,
      reason
    });

    setFeedback({ success: true, message: `${type} request submitted successfully.` });
    setStartDate('');
    setEndDate('');
    setReason('');
    setShowForm(false);
  };

  return (
    <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-8 shadow-2xl max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4 mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            My Leave & WFH Requests
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Submit new requests and track your approval status.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => { setType('WFH'); setShowForm(true); setFeedback(null); }}
            className={`flex items-center gap-2 px-4 py-2 ${showForm && type === 'WFH' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-purple-500 hover:text-white font-bold text-xs rounded-xl transition-colors`}
          >
            <Plus className="w-4 h-4" />
            Request WFH
          </button>
          <button
            onClick={() => { setType('Leave'); setShowForm(true); setFeedback(null); }}
            className={`flex items-center gap-2 px-4 py-2 ${showForm && type === 'Leave' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-orange-500 hover:text-white font-bold text-xs rounded-xl transition-colors`}
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </button>
          {showForm && (
            <button
              onClick={() => { setShowForm(false); setFeedback(null); }}
              className="flex items-center justify-center p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-colors"
              title="Cancel Request"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${feedback.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {feedback.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800/60 space-y-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Request Type</label>
              <div className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold flex items-center h-[42px]">
                {type === 'WFH' ? (
                  <span className="text-purple-400">Work From Home (WFH)</span>
                ) : (
                  <span className="text-orange-400">Time Off / Leave</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide a brief explanation for your request..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-blue-900/20"
            >
              <Send className="w-4 h-4" />
              Submit Request
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <th className="px-6 py-4">Request ID</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Dates</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Review Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {myRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                  You haven't submitted any leave or WFH requests.
                </td>
              </tr>
            ) : (
              myRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">{req.id}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      req.type === 'WFH' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'
                    }`}>
                      {req.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span>{req.startDate} {req.startDate !== req.endDate && `to ${req.endDate}`}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {req.status === 'Pending' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    {req.status === 'Approved' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        <Check className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {req.status === 'Rejected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                        <X className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {req.status !== 'Pending' ? (
                      <span className="text-slate-400 text-xs">{req.reviewNotes || `Reviewed by ${req.reviewedBy}`}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
