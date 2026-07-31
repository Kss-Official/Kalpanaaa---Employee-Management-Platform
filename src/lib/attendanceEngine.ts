import { CompanySettings, Employee, AttendanceRecord } from '../types';

/**
 * Haversine formula to calculate distance between two GPS points in meters
 */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Generate secure attendance payload for QR Code
 */
export function generateEmployeeQrToken(employee: Employee, expiryMinutes: number = 10): string {
  const timestamp = Date.now();
  const expiresAt = timestamp + expiryMinutes * 60 * 1000;
  const rawPayload = {
    empId: employee.employeeId,
    empDbId: employee.id,
    token: employee.qrToken,
    ts: timestamp,
    exp: expiresAt,
    ver: '2026.1'
  };
  return JSON.stringify(rawPayload);
}

export interface QrParseResult {
  valid: boolean;
  empId?: string;
  empDbId?: string;
  expired?: boolean;
  error?: string;
}

/**
 * Parse and validate QR code token payload
 */
export function parseAndValidateQrCode(qrText: string): QrParseResult {
  try {
    const data = JSON.parse(qrText);
    if (!data.empId || !data.token) {
      return { valid: false, error: 'Invalid QR format' };
    }
    if (data.exp && Date.now() > data.exp) {
      return { valid: false, expired: true, error: 'QR Code has expired. Please regenerate.' };
    }
    return {
      valid: true,
      empId: data.empId,
      empDbId: data.empDbId
    };
  } catch {
    // If simple text token match
    if (qrText.startsWith('EMP') || qrText.startsWith('QR-TOKEN-')) {
      return { valid: true, empId: qrText };
    }
    return { valid: false, error: 'Unrecognized QR code payload' };
  }
}

export interface CheckInEvaluation {
  allowed: boolean;
  action: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_CHECKED_OUT';
  status: 'Present' | 'Late' | 'Half Day';
  locationVerified: boolean;
  distanceMeters?: number;
  message: string;
}

/**
 * Evaluates whether check-in / check-out is valid based on settings, time, location
 */
export function evaluateAttendanceScan(
  employee: Employee,
  todayRecord: AttendanceRecord | undefined,
  settings: CompanySettings,
  userLat?: number,
  userLon?: number
): CheckInEvaluation {
  // 1. Check GPS Location if required
  let locationVerified = true;
  let distanceMeters = 0;
  
  if (settings.gpsRequired && userLat !== undefined && userLon !== undefined) {
    distanceMeters = calculateGpsDistanceMeters(
      userLat,
      userLon,
      settings.officeLatitude,
      settings.officeLongitude
    );
    if (distanceMeters > settings.allowedRadiusMeters) {
      locationVerified = false;
    }
  }

  // 2. Evaluate state
  if (!todayRecord || !todayRecord.checkInAt) {
    // Perform CHECK_IN
    const now = new Date();
    const [startH, startM] = settings.workStartTime.split(':').map(Number);
    const workStart = new Date();
    workStart.setHours(startH, startM, 0, 0);
    
    const graceCutoff = new Date(workStart.getTime() + settings.gracePeriodMinutes * 60000);
    
    let status: 'Present' | 'Late' = 'Present';
    if (now > graceCutoff) {
      status = 'Late';
    }

    if (settings.gpsRequired && !locationVerified) {
      return {
        allowed: false,
        action: 'CHECK_IN',
        status,
        locationVerified: false,
        distanceMeters,
        message: `Outside authorized office location (${distanceMeters}m away, limit is ${settings.allowedRadiusMeters}m).`
      };
    }

    return {
      allowed: true,
      action: 'CHECK_IN',
      status,
      locationVerified: true,
      distanceMeters,
      message: status === 'Late' 
        ? 'Checked In (Marked as Late Arrival)' 
        : 'Checked In Successfully'
    };
  } 
  
  if (todayRecord.checkInAt && !todayRecord.checkOutAt) {
    // Perform CHECK_OUT
    if (settings.gpsRequired && !locationVerified) {
      return {
        allowed: false,
        action: 'CHECK_OUT',
        status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
        locationVerified: false,
        distanceMeters,
        message: `Outside authorized office perimeter for Check-Out (${distanceMeters}m away).`
      };
    }

    return {
      allowed: true,
      action: 'CHECK_OUT',
      status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
      locationVerified: true,
      distanceMeters,
      message: 'Checked Out Successfully'
    };
  }

  // Already checked out today
  return {
    allowed: false,
    action: 'ALREADY_CHECKED_OUT',
    status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
    locationVerified: true,
    message: 'Attendance already completed for today.'
  };
}
