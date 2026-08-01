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
export function generateEmployeeQrToken(employee: Employee, _expiryMinutes: number = 10): string {
  // TOTP interval of 10 seconds
  const bucket = Math.floor(Date.now() / 10000);
  
  // Combine employee unique token with bucket to create a rotating hash
  const totpData = `${employee.id}|${employee.qrToken}|${bucket}`;
  const encoded = btoa(totpData);
  
  const rawPayload = {
    totp: encoded,
    empDbId: employee.id,
    ver: '2026.1_TOTP'
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
    if (!data.totp || !data.empDbId) {
      // Fallback for old tokens
      if (data.empId && data.token) {
        if (data.exp && Date.now() > data.exp) return { valid: false, expired: true, error: 'Expired' };
        return { valid: true, empId: data.empId, empDbId: data.empDbId };
      }
      return { valid: false, error: 'Invalid QR format' };
    }

    const decoded = atob(data.totp);
    const [empId, token, bucketStr] = decoded.split('|');
    const bucket = parseInt(bucketStr, 10);
    const currentBucket = Math.floor(Date.now() / 10000);
    
    // Allow +/- 1 bucket (10 seconds) for clock drift
    if (Math.abs(currentBucket - bucket) > 1) {
      return { valid: false, expired: true, error: 'SECURITY ALERT: QR Code has expired. Prevented possible screenshot replay attack.' };
    }

    return { valid: true, empDbId: data.empDbId, empId: empId, _token: token } as any;
  } catch (e) {
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
  userLon?: number,
  isApprovedWfh?: boolean
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

    if (settings.gpsRequired && !locationVerified && !isApprovedWfh) {
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
