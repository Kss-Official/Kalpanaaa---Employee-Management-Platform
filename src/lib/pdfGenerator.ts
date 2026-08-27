import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CompanySettings, Employee, AttendanceRecord } from '../types';
import { toISTTimeString } from './absoluteTime';

/**
 * PDF Generator Utility for HR Reports, ID Cards, and Statements
 */

export async function downloadElementAsPdf(elementId: string, filename: string = 'document.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found for PDF export.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // Helper function to replace unsupported oklch(...) colors in CSS text
        const convertOklchToRgbInCss = (cssText: string): string => {
          if (!cssText || !cssText.includes('oklch')) return cssText;
          const colorCache = new Map<string, string>();
          const tempDiv = document.createElement('div');
          tempDiv.style.display = 'none';
          document.body.appendChild(tempDiv);

          const getRgb = (oklchStr: string) => {
            if (colorCache.has(oklchStr)) return colorCache.get(oklchStr)!;
            try {
              tempDiv.style.color = oklchStr;
              const computed = window.getComputedStyle(tempDiv).color;
              const val = (computed && !computed.includes('oklch')) ? computed : 'rgb(59, 130, 246)';
              colorCache.set(oklchStr, val);
              return val;
            } catch {
              return 'rgb(59, 130, 246)';
            }
          };

          const converted = cssText.replace(/oklch\([^)]+\)/g, (match) => getRgb(match));
          if (tempDiv.parentNode) {
            tempDiv.parentNode.removeChild(tempDiv);
          }
          return converted;
        };

        // Convert oklch in all <style> elements in cloned document
        clonedDoc.querySelectorAll('style').forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = convertOklchToRgbInCss(styleEl.textContent);
          }
        });

        // Convert oklch in all inline style attributes in cloned document
        clonedDoc.querySelectorAll('*').forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.getAttribute && htmlEl.getAttribute('style')) {
            const styleAttr = htmlEl.getAttribute('style');
            if (styleAttr && styleAttr.includes('oklch')) {
              htmlEl.setAttribute('style', convertOklchToRgbInCss(styleAttr));
            }
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    // Fallback: browser print dialog
    window.print();
  }
}

/**
 * Generate programmatic PDF report for Attendance Records
 */
export function generateAttendanceReportPdf(
  records: AttendanceRecord[],
  settings: CompanySettings,
  title: string = 'Monthly Attendance Statement',
  subtitle: string = 'Generated Official Document'
) {
  const pdf = new jsPDF('portrait', 'mm', 'a4');

  // Header
  pdf.setFillColor(11, 19, 43); // #0B132B
  pdf.rect(0, 0, 210, 32, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(15);
  pdf.setFont('helvetica', 'bold');
  pdf.text('KALPANAAA SOFTWARE SOLUTIONS PVT. LTD.', 14, 14);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(203, 213, 225);
  pdf.text('Kalpanaaa Software Solutions Headquarters, 822, 9th Main, 1st C Cross, HRBR Layout, Kalyan Nagar, Bengaluru – 560043', 14, 22);

  // Document Title
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 14, 42);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${subtitle} | Date: ${new Date().toLocaleDateString('en-GB')}`, 14, 48);

  // Table Headers
  let startY = 56;
  pdf.setFillColor(241, 245, 249);
  pdf.rect(14, startY, 182, 8, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text('EMP ID', 18, startY + 5.5);
  pdf.text('EMPLOYEE NAME', 42, startY + 5.5);
  pdf.text('DEPARTMENT', 92, startY + 5.5);
  pdf.text('DATE', 130, startY + 5.5);
  pdf.text('CHECK IN', 155, startY + 5.5);
  pdf.text('STATUS', 180, startY + 5.5);

  startY += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 41, 59);

  records.slice(0, 25).forEach((rec, idx) => {
    if (startY > 270) {
      pdf.addPage();
      startY = 20;
    }

    const checkInTime = rec.checkInAt ? toISTTimeString(rec.checkInAt, false) : '--:--';

    pdf.text(rec.employeeCode, 18, startY);
    pdf.text(rec.employeeName.substring(0, 22), 42, startY);
    pdf.text(rec.department.substring(0, 18), 92, startY);
    pdf.text(rec.date, 130, startY);
    pdf.text(checkInTime, 155, startY);

    if (rec.status === 'Present') pdf.setTextColor(22, 101, 52); // green
    else if (rec.status === 'Late') pdf.setTextColor(180, 83, 9); // amber
    else if (rec.status === 'Absent') pdf.setTextColor(185, 28, 28); // red
    else pdf.setTextColor(71, 85, 105);

    pdf.text(rec.status, 180, startY);
    pdf.setTextColor(30, 41, 59);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(14, startY + 2, 196, startY + 2);
    startY += 7;
  });

  // Footer Signature Block
  const footerY = 275;
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Authorized by: Gaurav Kumar Tripathi (CTO) & Akshit Ujjain (CEO)', 14, footerY);
  pdf.text('Kalpanaaa Software Solutions Pvt. Ltd. | Confidential', 130, footerY);

  pdf.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export interface PayslipPdfData {
  monthLabel: string;
  issueDate: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  daysWorked: number;
  netPay: number;
  status: string;
}

/**
 * Converts a numeric amount to Indian Rupee Words
 */
function numberToWordsINR(amount: number): string {
  const rounded = Math.max(0, Math.round(amount));
  if (rounded === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? convertChunk(n % 100) : '');
  }

  let words = '';
  const crore = Math.floor(rounded / 10000000);
  let rem = rounded % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (crore > 0) words += convertChunk(crore) + 'Crore ';
  if (lakh > 0) words += convertChunk(lakh) + 'Lakh ';
  if (thousand > 0) words += convertChunk(thousand) + 'Thousand ';
  if (rem > 0) words += convertChunk(rem);

  return words.trim() + ' Rupees Only';
}

/**
 * Loads an image from a URL as a Data URL for jsPDF embedding
 */
async function loadLogoDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Generate official corporate PDF Payslip with stamp and verification
 */
export async function generatePayslipPdf(
  employee: Employee,
  payslip: PayslipPdfData,
  settings: CompanySettings
) {
  const pdf = new jsPDF('portrait', 'mm', 'a4');

  // Try to load official Kalpanaaa logo
  const logoData = await loadLogoDataUrl('/pwa-192x192.png') || await loadLogoDataUrl('/apple-touch-icon.png') || await loadLogoDataUrl('/favicon.png');

  // Outer Page Border
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(0.5);
  pdf.rect(8, 8, 194, 281);

  // 1. Header Banner (Deep Navy #0B132B)
  pdf.setFillColor(11, 19, 43); // #0B132B
  pdf.rect(8, 8, 194, 42, 'F');

  // Accent Line under header (Royal Blue #2563EB)
  pdf.setFillColor(37, 99, 235);
  pdf.rect(8, 50, 194, 1.5, 'F');

  // Embed Logo
  if (logoData) {
    try {
      pdf.addImage(logoData, 'PNG', 13, 14, 21, 21);
    } catch {
      // Fallback logo badge if image decoding fails
      pdf.setFillColor(37, 99, 235);
      pdf.roundedRect(13, 14, 21, 21, 3, 3, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('K', 21, 28);
    }
  } else {
    pdf.setFillColor(37, 99, 235);
    pdf.roundedRect(13, 14, 21, 21, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('K', 21, 28);
  }

  // Payslip Badge Banner (Right-aligned, fixed width to prevent any overlap)
  pdf.setFillColor(37, 99, 235); // blue-600
  pdf.roundedRect(144, 13, 52, 17, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SALARY PAYSLIP', 148, 20);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(payslip.monthLabel.toUpperCase(), 148, 26);

  // Company Name & Info (Left-aligned, constrained to 98mm max width to prevent overlap)
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('KALPANAAA SOFTWARE SOLUTIONS PVT. LTD.', 37, 17);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(203, 213, 225); // slate-300
  pdf.text('CIN: U72200KA2024PTC189000 | GSTIN: 29AAGCK1234F1Z5', 37, 23);
  pdf.text('Kalpanaaa Software Solutions Headquarters, 822, 9th Main,', 37, 28);
  pdf.text('1st C Cross, 1st Block, HRBR Layout, Kalyan Nagar, Bengaluru – 560043', 37, 33);
  pdf.text('Official: https://www.kalpanaaasoftwaresolutions.in/ | hr@kalpanaaa.in', 37, 38);

  // 2. Reference & Date Bar
  let y = 54;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(12, y, 186, 7, 'F');
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Payslip Ref: KSS/PAY/${payslip.monthLabel.replace(/\s+/g, '-').toUpperCase()}/${employee.employeeId}`, 15, y + 4.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Issue Date: ${payslip.issueDate || new Date().toLocaleDateString('en-GB')}`, 145, y + 4.5);

  // 3. Employee Information Box (Clean 2-Column Grid without bank & employee address)
  y = 64;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(12, y, 186, 42, 2, 2, 'D');

  // Title Bar of Employee Info
  pdf.setFillColor(241, 245, 249);
  pdf.rect(12, y, 186, 7, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('EMPLOYEE IDENTIFICATION & POSITION PROFILE', 16, y + 5);

  // Column 1 (Left)
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139); // slate-500
  pdf.text('Employee Name:', 16, y + 14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.fullName, 48, y + 14);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Employee Code:', 16, y + 21);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(37, 99, 235); // blue-600
  pdf.text(employee.employeeId, 48, y + 21);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Designation:', 16, y + 28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.designation || 'Software Engineer', 48, y + 28);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Department:', 16, y + 35);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.department || 'Engineering', 48, y + 35);

  // Column 2 (Right)
  const col2X = 112;
  const col2ValX = 148;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Date of Joining:', col2X, y + 14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.joiningDate || '01-Aug-2024', col2ValX, y + 14);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Days Payable / Worked:', col2X, y + 21);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${payslip.daysWorked} Days (Rostered: 26)`, col2ValX, y + 21);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Disbursement Status:', col2X, y + 28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(5, 150, 105); // emerald-600
  pdf.text(`${payslip.status.toUpperCase()} (Direct Deposit)`, col2ValX, y + 28);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Work Location / Mode:', col2X, y + 35);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text(employee.workLocation || 'Kalpanaaa Software Solutions Headquarters', col2ValX, y + 35);

  // 4. Financial Breakdown Table (Earnings vs Deductions)
  y = 112;
  pdf.setFillColor(15, 23, 42);
  pdf.rect(12, y, 92, 8, 'F');
  pdf.rect(106, y, 92, 8, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('EARNINGS & ALLOWANCES', 16, y + 5.5);
  pdf.text('AMOUNT (INR)', 78, y + 5.5);

  pdf.text('DEDUCTIONS & ADJUSTMENTS', 110, y + 5.5);
  pdf.text('AMOUNT (INR)', 172, y + 5.5);

  y += 8;

  // Breakdown values
  const basicSalary = Math.round(payslip.baseSalary * 0.6);
  const hra = Math.round(payslip.baseSalary * 0.3);
  const specialAllowance = Math.max(0, payslip.baseSalary - basicSalary - hra + (payslip.allowances || 0));
  const grossEarnings = payslip.baseSalary + (payslip.allowances || 0);

  const ptDeduction = 200;
  const lopDeduction = payslip.deductions;
  const totalDeductions = lopDeduction + ptDeduction;

  const rows = [
    { earnName: 'Basic Salary', earnVal: basicSalary, dedName: 'Loss of Pay (LOP) / Absence', dedVal: lopDeduction },
    { earnName: 'House Rent Allowance (HRA)', earnVal: hra, dedName: 'Professional Tax (PT)', dedVal: ptDeduction },
    { earnName: 'Special & Conveyance Allowance', earnVal: specialAllowance, dedName: 'Provident Fund (PF)', dedVal: 0 },
    { earnName: 'Performance / Sprint Incentive', earnVal: 0, dedName: 'Tax Deducted at Source (TDS)', dedVal: 0 },
  ];

  pdf.setFontSize(7.5);
  rows.forEach((r, idx) => {
    const rowY = y + (idx * 8);
    pdf.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    pdf.rect(12, rowY, 92, 8, 'F');
    pdf.rect(106, rowY, 92, 8, 'F');

    pdf.setDrawColor(226, 232, 240);
    pdf.line(12, rowY + 8, 104, rowY + 8);
    pdf.line(106, rowY + 8, 198, rowY + 8);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(r.earnName, 16, rowY + 5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Rs. ${r.earnVal.toLocaleString('en-IN')}`, 78, rowY + 5.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(r.dedName, 110, rowY + 5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Rs. ${r.dedVal.toLocaleString('en-IN')}`, 172, rowY + 5.5);
  });

  // Table Totals Row
  y += rows.length * 8;
  pdf.setFillColor(241, 245, 249);
  pdf.rect(12, y, 92, 8, 'F');
  pdf.rect(106, y, 92, 8, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('TOTAL GROSS EARNINGS', 16, y + 5.5);
  pdf.text(`Rs. ${grossEarnings.toLocaleString('en-IN')}`, 78, y + 5.5);

  pdf.text('TOTAL DEDUCTIONS', 110, y + 5.5);
  pdf.setTextColor(225, 29, 72); // rose-600
  pdf.text(`Rs. ${totalDeductions.toLocaleString('en-IN')}`, 172, y + 5.5);

  // 5. Net Salary Highlight Strip
  y += 14;
  pdf.setFillColor(236, 253, 245); // emerald-50
  pdf.setDrawColor(16, 185, 129); // emerald-500
  pdf.setLineWidth(0.8);
  pdf.roundedRect(12, y, 186, 24, 2, 2, 'FD');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(6, 95, 70); // emerald-800
  pdf.text('NET SALARY DISBURSED:', 18, y + 9);

  pdf.setFontSize(15);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(4, 120, 87); // emerald-700
  pdf.text(`Rs. ${payslip.netPay.toLocaleString('en-IN')}/-`, 68, y + 9.5);

  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Amount in Words: ${numberToWordsINR(payslip.netPay)}`, 18, y + 17);
  pdf.text(`Payment Mode: Direct Bank Deposit (NEFT/IMPS)`, 130, y + 17);

  // 6. Corporate Verification & Two Authorized Signatories Section
  y += 30;

  // Box 1: Official Corporate Seal (Left)
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(12, y, 58, 46, 2, 2, 'D');

  pdf.setFillColor(248, 250, 252);
  pdf.rect(12, y, 58, 6, 'F');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('CORPORATE SEAL & AUTHENTICATION', 15, y + 4.5);

  // Draw Detailed Professional Vector Stamp
  const sealCenterX = 41;
  const sealCenterY = y + 26;
  pdf.setDrawColor(30, 64, 175); // Royal Blue #1E40AF
  pdf.setLineWidth(0.8);
  pdf.circle(sealCenterX, sealCenterY, 14, 'D');
  pdf.setLineWidth(0.3);
  pdf.circle(sealCenterX, sealCenterY, 12.5, 'D');

  pdf.setFontSize(4.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175);
  pdf.text('★ KALPANAAA SOFTWARE SOLUTIONS ★', sealCenterX - 11, sealCenterY - 7);
  pdf.setFontSize(5);
  pdf.text('OFFICIAL SEAL', sealCenterX - 7, sealCenterY - 1);
  pdf.setFontSize(4);
  pdf.text('HRMS CERTIFIED', sealCenterX - 7, sealCenterY + 3);
  pdf.setFontSize(4.5);
  pdf.text('★ BENGALURU, INDIA ★', sealCenterX - 8, sealCenterY + 7);

  pdf.setFontSize(6);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Doc ID: KSS-${employee.employeeId}-${Date.now().toString().slice(-4)}`, 16, y + 43);

  // Box 2: Authorized Signatory 1 - Chief Technology Officer & Co-Founder (Center)
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(74, y, 58, 46, 2, 2, 'D');

  pdf.setFillColor(248, 250, 252);
  pdf.rect(74, y, 58, 6, 'F');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('AUTHORIZED SIGNATORY 1', 78, y + 4.5);

  // Signatory 1 details: Gaurav Kumar Tripathi (CTO)
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text('Gaurav Kumar Tripathi', 77, y + 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Chief Technology Officer & Co-Founder', 77, y + 28);
  pdf.text('Kalpanaaa Software Solutions Pvt. Ltd.', 77, y + 33);

  // Authenticated Badge Pill
  pdf.setFillColor(236, 253, 245); // emerald-50
  pdf.setDrawColor(16, 185, 129); // emerald-500
  pdf.setLineWidth(0.4);
  pdf.roundedRect(76, y + 37, 54, 6, 1.2, 1.2, 'FD');
  pdf.setFontSize(4.8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(4, 120, 87); // emerald-700
  pdf.text('✓ DIGITALLY AUTHENTICATED & SIGNED', 77.5, y + 41.2);

  // Box 3: Authorized Signatory 2 - Chief Executive Officer & Founder (Right)
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(136, y, 62, 46, 2, 2, 'D');

  pdf.setFillColor(248, 250, 252);
  pdf.rect(136, y, 62, 6, 'F');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('AUTHORIZED SIGNATORY 2', 140, y + 4.5);

  // Signatory 2 details: Akshit Ujjain (CEO)
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text('Akshit Ujjain', 139, y + 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Chief Executive Officer & Founder', 139, y + 28);
  pdf.text('Kalpanaaa Software Solutions Pvt. Ltd.', 139, y + 33);

  // Authenticated Badge Pill
  pdf.setFillColor(236, 253, 245); // emerald-50
  pdf.setDrawColor(16, 185, 129); // emerald-500
  pdf.setLineWidth(0.4);
  pdf.roundedRect(138, y + 37, 58, 6, 1.2, 1.2, 'FD');
  pdf.setFontSize(4.8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(4, 120, 87); // emerald-700
  pdf.text('✓ DIGITALLY AUTHENTICATED & SIGNED', 139.5, y + 41.2);

  // 7. Footer Notice
  const footerY = 277;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(8, footerY - 4, 194, 16, 'F');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    'This is a computer-generated, digitally encrypted payslip statement issued under the Information Technology Act, 2000.',
    12,
    footerY + 1
  );
  pdf.text(
    'Kalpanaaa Software Solutions Headquarters, 822, 9th Main, 1st C Cross, HRBR Layout, Kalyan Nagar, Bengaluru – 560043 | hr@kalpanaaa.in',
    12,
    footerY + 5
  );

  pdf.save(`Payslip_${employee.fullName.replace(/\s+/g, '_')}_${payslip.monthLabel.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generate WhatsApp deep-link message
 */
export function openWhatsAppShare(title: string, summary: string) {
  const text = encodeURIComponent(
    `*${title}*\n\n` +
    `${summary}\n\n` +
    `_Generated securely from Enterprise HRMS Platform._`
  );
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

/**
 * Generate Email pre-filled link
 */
export function openEmailShare(recipient: string, subject: string, bodyText: string) {
  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.open(mailtoUrl, '_blank');
}
