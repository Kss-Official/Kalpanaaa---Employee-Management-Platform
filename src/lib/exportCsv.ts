import { AttendanceRecord } from '../types';
import { toISTTimeString } from './absoluteTime';

export const exportAttendanceToCSV = (records: AttendanceRecord[], filename: string) => {
  if (records.length === 0) {
    alert("No records to export");
    return;
  }

  // Define headers
  const headers = [
    "Date",
    "Employee Code",
    "Employee Name",
    "Department",
    "Check In",
    "Check Out",
    "Working Hours",
    "Status",
    "Attendance Method",
    "Location Verified",
    "Breaks Info",
    "Total Break Minutes"
  ];

  // Map data to rows
  const rows = records.map(rec => {
    const checkIn = rec.checkInAt ? toISTTimeString(rec.checkInAt) : '--';
    const checkOut = rec.checkOutAt ? toISTTimeString(rec.checkOutAt) : '--';
    const workingHours = rec.workingMinutes > 0 ? `${Math.floor(rec.workingMinutes / 60)}h ${rec.workingMinutes % 60}m` : '--';
    
    let breaksInfo = 'No Breaks';
    if (rec.breaks && rec.breaks.length > 0) {
      breaksInfo = rec.breaks.map(b => {
        const start = toISTTimeString(b.startAt);
        const end = b.endAt ? toISTTimeString(b.endAt) : 'Ongoing';
        return `${b.type} (${start} - ${end}) [${b.durationMinutes}m]`;
      }).join(' | ');
    }

    return [
      rec.date,
      rec.employeeCode,
      `"${rec.employeeName}"`, // Quotes to escape commas in names
      rec.department,
      checkIn,
      checkOut,
      workingHours,
      rec.status,
      rec.attendanceMethod,
      rec.locationVerified ? "Yes" : "No",
      `"${breaksInfo}"`, // Quotes to escape inner commas/pipes
      rec.totalBreakMinutes || 0
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
