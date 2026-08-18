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
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, 210, 32, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(settings.companyName.toUpperCase(), 14, 14);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${settings.companyAddress} | ${settings.companyPhone}`, 14, 22);

  // Document Title
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 14, 42);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${subtitle} | Date: ${new Date().toLocaleDateString()}`, 14, 48);

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
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Authorized by: ${settings.authorizedSignatureName} (${settings.authorizedSignatureTitle})`, 14, footerY);
  pdf.text(`Page 1 of 1 - Confidential Enterprise Record`, 140, footerY);

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
 * Generate official corporate PDF Payslip with stamp and verification
 */
export function generatePayslipPdf(
  employee: Employee,
  payslip: PayslipPdfData,
  settings: CompanySettings
) {
  const pdf = new jsPDF('portrait', 'mm', 'a4');

  // Header Banner
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, 210, 36, 'F');

  // Company Name & Logo Text
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(settings.companyName.toUpperCase(), 14, 15);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text(`${settings.companyAddress} | Ph: ${settings.companyPhone}`, 14, 23);
  pdf.text(`Official Corporate Payslip Statement — Confidential`, 14, 29);

  // Payslip Badge Banner Right
  pdf.setFillColor(37, 99, 235); // blue-600
  pdf.roundedRect(135, 10, 61, 16, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SALARY PAYSLIP', 140, 18);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(payslip.monthLabel, 140, 23);

  // Employee Information Box
  let y = 46;
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(14, y, 182, 32, 2, 2, 'FD');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('EMPLOYEE DETAILS', 18, y + 7);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  
  pdf.text(`Employee Name:`, 18, y + 15);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.fullName, 45, y + 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Employee Code:`, 18, y + 23);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.employeeId, 45, y + 23);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Designation:`, 110, y + 15);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.designation, 135, y + 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Department:`, 110, y + 23);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(employee.department, 135, y + 23);

  // Breakdown Table Headers
  y = 86;
  pdf.setFillColor(241, 245, 249);
  pdf.rect(14, y, 182, 9, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(51, 65, 85);
  pdf.text('EARNINGS / COMPONENT', 18, y + 6);
  pdf.text('AMOUNT (INR)', 95, y + 6);
  pdf.text('DEDUCTIONS & ADJUSTMENTS', 120, y + 6);
  pdf.text('AMOUNT (INR)', 165, y + 6);

  y += 9;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);

  // Row 1: Base Salary
  pdf.text('Basic Salary', 18, y + 6);
  pdf.text(`Rs. ${payslip.baseSalary.toLocaleString('en-IN')}`, 95, y + 6);
  pdf.text('Attendance Deductions', 120, y + 6);
  pdf.text(`Rs. ${payslip.deductions.toLocaleString('en-IN')}`, 165, y + 6);
  pdf.setDrawColor(226, 232, 240);
  pdf.line(14, y + 9, 196, y + 9);

  // Row 2: Allowances
  y += 10;
  pdf.text('Fixed Allowances', 18, y + 6);
  pdf.text(`Rs. ${payslip.allowances.toLocaleString('en-IN')}`, 95, y + 6);
  pdf.text('Days Worked / Total', 120, y + 6);
  pdf.text(`${payslip.daysWorked} / 22 Days`, 165, y + 6);
  pdf.line(14, y + 9, 196, y + 9);

  // Net Payable Summary Highlight Box
  y += 18;
  pdf.setFillColor(236, 253, 245); // emerald-50
  pdf.setDrawColor(16, 185, 129); // emerald-500
  pdf.roundedRect(14, y, 182, 22, 3, 3, 'FD');

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(6, 95, 70); // emerald-800
  pdf.text('NET SALARY PAYABLE:', 20, y + 14);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(4, 120, 87);
  pdf.text(`Rs. ${payslip.netPay.toLocaleString('en-IN')}`, 80, y + 14);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Disbursement Status: ${payslip.status.toUpperCase()}`, 145, y + 14);

  // Corporate Stamp & Authorization Box
  y += 32;
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(14, y, 90, 40, 'D');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('CORPORATE SEAL & VERIFICATION', 18, y + 7);

  // Draw circular official stamp
  pdf.setDrawColor(37, 99, 235); // blue
  pdf.circle(60, y + 25, 11, 'D');
  pdf.setFontSize(6);
  pdf.setTextColor(37, 99, 235);
  pdf.text('KALPANAAA HRMS', 46, y + 23);
  pdf.text('★ VERIFIED ★', 48, y + 27);

  // Signature Box Right
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(106, y, 90, 40, 'D');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('AUTHORIZED SIGNATORY', 110, y + 7);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Name: ${settings.authorizedSignatureName}`, 110, y + 20);
  pdf.text(`Title: ${settings.authorizedSignatureTitle}`, 110, y + 26);
  pdf.text(`Date of Issue: ${payslip.issueDate}`, 110, y + 32);

  // Footer Disclaimer
  const footerY = 275;
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Computer generated document. Valid without physical signature under IT Act 2000.`, 14, footerY);
  pdf.text(`Kalpanaaa Software Solutions Private Limited | HR Management Portal`, 120, footerY);

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
