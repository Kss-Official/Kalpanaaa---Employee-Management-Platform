import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Check, X, Clock, UserCheck, CalendarDays, FileText } from 'lucide-react';

export const LeaveApprovalsView: React.FC = () => {
  const { leaveRequests, updateLeaveRequestStatus, activeEmployee } = useAuth();

  const handleApprove = (id: string) => {
    updateLeaveRequestStatus(id, 'Approved', activeEmployee?.fullName || 'Admin');
  };

  const handleReject = (id: string) => {
    updateLeaveRequestStatus(id, 'Rejected', activeEmployee?.fullName || 'Admin');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            Leave & WFH Sanctions
          </h1>
          <p className="text-slate-400 text-sm mt-1">Review and manage employee leave and remote work requests.</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leaveRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No pending leave or WFH requests found.
                  </td>
                </tr>
              ) : (
                leaveRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-bold">{req.employeeName}</span>
                        <span className="text-slate-500 text-[10px]">{req.employeeId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        req.type === 'WFH' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        {req.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <CalendarDays className="w-4 h-4 text-slate-500" />
                        <span>{req.startDate} {req.startDate !== req.endDate && `to ${req.endDate}`}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={req.reason}>
                      <span className="text-slate-400">{req.reason}</span>
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
                      {req.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(req.id)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Reviewed by {req.reviewedBy}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
