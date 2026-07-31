import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DOCUMENT_TEMPLATES } from '../../lib/demoData';
import { FileText, Printer, Download, Share2, Edit2, Eye, Check } from 'lucide-react';
import { downloadElementAsPdf, openWhatsAppShare } from '../../lib/pdfGenerator';

export const DocumentGenerator: React.FC = () => {
  const { employees, settings } = useAuth();

  const [selectedTemplate, setSelectedTemplate] = useState(DOCUMENT_TEMPLATES[2]); // HR letter default
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [customTitle, setCustomTitle] = useState(selectedTemplate.title);
  const [editingContent, setEditingContent] = useState(selectedTemplate.contentMarkdown);
  const [isPreview, setIsPreview] = useState(true);

  const activeEmp = employees.find(e => e.id === selectedEmpId) || employees[0];

  // Helper to substitute variables
  const formatDocumentContent = (rawText: string) => {
    if (!activeEmp) return rawText;
    return rawText
      .replace(/{{FULL_NAME}}/g, activeEmp.fullName)
      .replace(/{{EMPLOYEE_ID}}/g, activeEmp.employeeId)
      .replace(/{{DEPARTMENT}}/g, activeEmp.department)
      .replace(/{{DESIGNATION}}/g, activeEmp.designation)
      .replace(/{{JOINING_DATE}}/g, activeEmp.joiningDate)
      .replace(/{{WORK_LOCATION}}/g, activeEmp.workLocation)
      .replace(/{{EMERGENCY_CONTACT}}/g, activeEmp.emergencyContact)
      .replace(/{{CURRENT_DATE}}/g, new Date().toLocaleDateString())
      .replace(/{{CURRENT_MONTH}}/g, new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  };

  const formattedDocText = formatDocumentContent(editingContent);

  const handleSelectTemplate = (tmpl: typeof DOCUMENT_TEMPLATES[0]) => {
    setSelectedTemplate(tmpl);
    setCustomTitle(tmpl.title);
    setEditingContent(tmpl.contentMarkdown);
  };

  const handleDownloadPdf = () => {
    downloadElementAsPdf('document-preview-paper', `${selectedTemplate.id}_${activeEmp?.employeeId || 'doc'}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Enterprise HR Document Generator</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate formal employment verification letters, certificates, and HR confirmations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Template Selector & Employee Picker */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2">
            1. Template & Employee Selection
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Select Employee Target</label>
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeId} - {emp.fullName} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Select Document Template</label>
              <div className="space-y-2">
                {DOCUMENT_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      selectedTemplate.id === tmpl.id ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-white">{tmpl.title}</div>
                    <div className="text-[11px] text-slate-400 font-normal mt-0.5">{tmpl.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsPreview(!isPreview)}
                className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isPreview ? <Edit2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {isPreview ? 'Edit Template Content' : 'Switch to Preview Mode'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Document Paper Canvas */}
        <div className="lg:col-span-2 bg-slate-950 p-6 rounded-3xl border border-slate-800 flex justify-center shadow-xl">
          <div
            id="document-preview-paper"
            className="w-full max-w-2xl bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-2xl text-slate-900 min-h-[500px] flex flex-col justify-between"
          >
            <div>
              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">{settings.companyName}</h2>
                  <p className="text-xs text-slate-500">{settings.companyAddress}</p>
                </div>
                <div className="text-right text-xs text-slate-500 font-mono">
                  REF: HR/{activeEmp?.employeeId || '101'}/{new Date().getFullYear()}
                </div>
              </div>

              {/* Dynamic Document Text */}
              {isPreview ? (
                <div className="prose prose-sm text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">
                  {formattedDocText}
                </div>
              ) : (
                <textarea
                  value={editingContent}
                  onChange={e => setEditingContent(e.target.value)}
                  rows={16}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              )}
            </div>

            {/* Official Footer Signature Block */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex items-end justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900">{settings.authorizedSignatureName}</p>
                <p className="text-[11px] text-slate-500">{settings.authorizedSignatureTitle}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{settings.companyName}</p>
              </div>

              <div className="w-24 h-12 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 uppercase font-mono">
                [SEAL / STAMP]
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
