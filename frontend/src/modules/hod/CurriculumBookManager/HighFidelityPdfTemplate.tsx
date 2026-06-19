import React, { useEffect, useState } from 'react';
import { Printer, RefreshCw, AlertCircle, BookOpen } from 'lucide-react';
import { api } from '../../../services/api';
import adityaLogo from '../../../assets/aditya-logo.png';

interface TemplateProps {
  book: any;
  sections: any[];
}

export const HighFidelityPdfTemplate: React.FC<TemplateProps> = ({ book, sections }) => {
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generatePreview = async () => {
    if (!book?._id) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.curriculumBooks.livePreview(book._id);
      setPreviewHtml(res.html || '');
    } catch (err: any) {
      setError(`Preview failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (book?._id) {
      generatePreview();
    }
  }, [book?._id]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && previewHtml) {
      printWindow.document.open();
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 800);
    } else {
      window.print();
    }
  };

  const departmentName = book?.departmentId?.name || 'Computer Science and Engineering';
  const regulation = book?.regulation || 'R24';
  const academicYear = book?.academicYear || '2024-25';

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-print">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Live PDF Preview</h3>
          <p className="text-xs text-slate-500 mt-1">
            Dynamically generated from MongoDB. Exactly matches the curriculum PDF format.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={generatePreview}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-900 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Refresh Preview'}
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !previewHtml}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-600">Generating curriculum book preview...</p>
          <p className="text-xs text-slate-400 mt-1">Fetching all courses, CO-PO mappings, and syllabus units from database</p>
        </div>
      )}

      {/* Live preview iframe */}
      {!loading && previewHtml && (
        <div className="rounded-xl overflow-hidden border border-slate-300 shadow-lg" style={{ height: '80vh' }}>
          <iframe
            srcDoc={previewHtml}
            title="Curriculum Book Preview"
            className="w-full h-full"
            style={{ border: 'none' }}
          />
        </div>
      )}

      {/* Empty state — static preview */}
      {!loading && !previewHtml && !error && (
        <div
          className="curriculum-book"
          id="high-fidelity-pdf-root"
          style={{ width: '210mm', margin: '0 auto', background: '#fff', boxShadow: '0 20px 50px rgba(15,23,42,0.18)' }}
        >
          {/* Cover */}
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            textAlign: 'center', height: '297mm', padding: '28mm 22mm 24mm',
            border: '2px solid #111827', outline: '4px double #111827', outlineOffset: '-9mm',
            fontFamily: '"Times New Roman", serif'
          }}>
            <div>
              <img src={adityaLogo} alt="Aditya University" style={{ height: '90px', margin: '0 auto 16px', display: 'block' }} />
              <h1 style={{ fontSize: '22pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12mm' }}>Program Curriculum</h1>
              <p style={{ fontSize: '11pt', fontWeight: 600, marginBottom: '4mm' }}>for</p>
              <p style={{ fontSize: '15pt', fontWeight: 800, textTransform: 'uppercase', color: '#991b1b', marginBottom: '4mm' }}>B. Tech. Four Year Degree Program</p>
              <p style={{ fontSize: '10.5pt', fontWeight: 600 }}>(Applicable for the batches admitted from A.Y. {academicYear})</p>
            </div>
            <div>
              <p style={{ fontSize: '15pt', fontWeight: 800, textTransform: 'uppercase', color: '#991b1b', marginBottom: '3mm' }}>{departmentName}</p>
              <p style={{ fontSize: '11pt', fontWeight: 600 }}>{regulation} Curriculum</p>
            </div>
            <div>
              <p style={{ fontSize: '11pt', fontWeight: 600 }}>Aditya Nagar, ADB Road, Surampalem - 533 437</p>
              <p style={{ fontSize: '11pt', fontWeight: 600, marginTop: '2mm' }}>Aditya University</p>
            </div>
          </div>

          <div style={{ padding: '20mm 18mm', fontFamily: '"Times New Roman", serif' }}>
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <BookOpen style={{ width: '40px', height: '40px', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 600, fontSize: '12pt' }}>Click "Refresh Preview" to generate the full curriculum book</p>
              <p style={{ fontSize: '10pt', marginTop: '8px' }}>All course pages, CO-PO mappings, and semester tables will be fetched dynamically</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HighFidelityPdfTemplate;
