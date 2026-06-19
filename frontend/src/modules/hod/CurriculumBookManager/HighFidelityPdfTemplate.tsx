import React from 'react';
import { Printer } from 'lucide-react';
import adityaLogo from '../../../assets/aditya-logo.png';

interface TemplateProps {
  book: any;
  sections: any[];
}

const getSectionHtml = (section: any) => (
  section?.sectionContent?.html
  || section?.sectionContent?.htmlContent
  || section?.sectionContent?.richTextContent
  || section?.sectionContent?.body
  || ''
);

const renderSection = (section: any, pageIndex: number) => {
  const content = section.sectionContent || {};

  if (section.sectionType === 'ProgramInfo') {
    return (
      <div className="curriculum-content-section" key={section._id || pageIndex}>
        <h2>{section.sectionTitle || 'Department Vision and Mission'}</h2>
        <h3>Vision of the Department</h3>
        <div className="curriculum-rich" dangerouslySetInnerHTML={{ __html: content.vision || '' }} />
        <h3>Mission of the Department</h3>
        <div className="curriculum-rich" dangerouslySetInnerHTML={{ __html: content.mission || '' }} />
      </div>
    );
  }

  return (
    <div className="curriculum-content-section" key={section._id || pageIndex}>
      <h2>{section.sectionTitle || `Section ${pageIndex + 1}`}</h2>
      <div className="curriculum-rich" dangerouslySetInnerHTML={{ __html: getSectionHtml(section) }} />
    </div>
  );
};

export const HighFidelityPdfTemplate: React.FC<TemplateProps> = ({ book, sections }) => {
  const handlePrint = () => {
    window.print();
  };

  const departmentName = book?.departmentId?.name || 'Computer Science and Engineering';
  const regulation = book?.regulation || 'R24';
  const academicYear = book?.academicYear || '2024-2025';

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center no-print">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Official PDF Preview</h3>
          <p className="text-xs text-slate-500">A4 print layout with official curriculum cover, headers, tables, and footer treatment.</p>
        </div>
        <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      <div className="curriculum-book" id="high-fidelity-pdf-root">
        <div className="curriculum-cover">
          <div>
            <img src={adityaLogo} alt="Aditya Logo" style={{ height: '120px', margin: '0 auto 20px', display: 'block' }} />
            <h1>Program Curriculum</h1>
            <p className="cover-small">for</p>
            <p className="cover-program">B. Tech. Four Year Degree Program</p>
            <p className="cover-meta">(Applicable for the batches admitted from A.Y. {academicYear})</p>
          </div>
          <div>
            <p className="cover-dept">{departmentName}</p>
            <p className="cover-meta">{regulation} Curriculum</p>
          </div>
          <div>
            <p className="cover-campus">Aditya Nagar, ADB Road, Surampalem - 533 437</p>
            <p className="cover-campus">Aditya University</p>
          </div>
        </div>

        <table className="print-wrapper">
          <thead className="print-header">
            <tr><td><div style={{ height: '10mm' }}></div></td></tr>
          </thead>
          <tbody>
            <tr><td>
              <div className="page-content">
                {sections.map((section, index) => renderSection(section, index + 1))}
              </div>
            </td></tr>
          </tbody>
          <tfoot className="print-footer">
            <tr><td>
              <div style={{ height: '15mm', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div className="curriculum-footer">
                  <span>B.Tech ({departmentName}) Curriculum-{regulation}</span>
                  <span>Aditya University</span>
                </div>
              </div>
            </td></tr>
          </tfoot>
        </table>
      </div>

      <style>{`
        .curriculum-book {
          width: 210mm;
          margin: 0 auto;
          background: #fff;
          color: #111827;
          font-family: "Times New Roman", Times, serif;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
        }
        
        table.print-wrapper { width: 100%; border-collapse: collapse; border: none; margin: 0; }
        thead.print-header { display: table-header-group; }
        tfoot.print-footer { display: table-footer-group; }
        
        .page-content { padding: 0 18mm; background: white; position: relative; }
        .curriculum-content-section { margin-bottom: 10mm; }

        .curriculum-cover {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          height: 250mm;
          padding: 28mm 20mm 24mm;
          border: 2px solid #111827;
          outline: 4px double #111827;
          outline-offset: -9mm;
          page-break-after: always;
        }
        .curriculum-cover h1 {
          margin: 0;
          color: #111827;
          font-size: 25pt;
          line-height: 1.35;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .cover-small,
        .cover-meta,
        .cover-campus {
          text-align: center;
          font-size: 12pt;
          font-weight: 700;
          margin: 5mm 0 0;
        }
        .cover-program,
        .cover-dept {
          text-align: center;
          color: #991b1b;
          font-size: 16pt;
          text-transform: uppercase;
          font-weight: 800;
          margin: 6mm 0;
        }
        
        .curriculum-footer {
          border-top: 1px solid #1f2937;
          padding-top: 3mm;
          display: flex;
          justify-content: space-between;
          font-size: 10pt;
          color: #1f2937;
          margin: 0 10mm;
        }
        .curriculum-content-section h2 {
          position: relative;
          z-index: 1;
          margin: 0 0 10mm;
          text-align: center;
          color: #111827;
          font-size: 17pt;
          line-height: 1.25;
          text-transform: uppercase;
          border-bottom: 1.5px solid #111827;
          padding-bottom: 2mm;
          page-break-before: always;
        }
        .curriculum-content-section h3 {
          position: relative;
          z-index: 1;
          margin: 8mm 0 3mm;
          color: #991b1b;
          text-align: center;
          font-size: 14pt;
          text-transform: uppercase;
        }
        .curriculum-rich {
          position: relative;
          z-index: 1;
          font-size: 11pt;
          font-family: "Times New Roman", Times, serif !important;
          line-height: 1.42;
        }
        .curriculum-rich p,
        .curriculum-rich li,
        .curriculum-rich td,
        .curriculum-rich th,
        .curriculum-rich span,
        .curriculum-rich strong,
        .curriculum-rich em,
        .curriculum-rich u {
          font-size: 11pt !important;
          font-family: "Times New Roman", Times, serif !important;
          line-height: 1.42 !important;
        }
        .curriculum-rich h1,
        .curriculum-rich h2,
        .curriculum-rich h3,
        .curriculum-rich h4 {
          font-size: 12pt !important;
          font-family: "Times New Roman", Times, serif !important;
          font-weight: bold !important;
          margin-top: 3mm !important;
          margin-bottom: 2mm !important;
        }
        .curriculum-rich p {
          margin: 0 0 4mm;
          text-align: justify;
        }
        .curriculum-rich table {
          width: 100%;
          border-collapse: collapse;
          margin: 4mm 0;
          page-break-inside: auto;
        }
        .curriculum-rich th,
        .curriculum-rich td {
          border: 1px solid #111827;
          padding: 2mm 2.5mm;
          vertical-align: top;
        }
        .curriculum-rich th {
          background: #f3f4f6;
          text-align: center;
          font-weight: 700;
        }
        .curriculum-rich img {
          max-width: 100%;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden; }
          #high-fidelity-pdf-root,
          #high-fidelity-pdf-root * { visibility: visible; }
          #high-fidelity-pdf-root {
            position: absolute;
            inset: 0 auto auto 0;
            margin: 0;
            box-shadow: none;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default HighFidelityPdfTemplate;
