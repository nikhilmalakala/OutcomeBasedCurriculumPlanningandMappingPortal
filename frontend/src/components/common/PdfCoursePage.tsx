import React from 'react';
import adityaLogo from '../../assets/aditya-logo.png';

const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const escapeHtml = (value = ''): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const legacyUnitToHtml = (unit: any): string => {
  const parts = [];
  if (unit?.title) parts.push(`<p><strong>${escapeHtml(unit.title)}</strong></p>`);
  if (unit?.description) parts.push(`<p>${escapeHtml(unit.description).replace(/\n/g, '<br>')}</p>`);
  if (Array.isArray(unit?.topics) && unit.topics.some((topic: string) => topic?.trim())) {
    parts.push(`<p>${escapeHtml(unit.topics.filter(Boolean).join(', '))}</p>`);
  }
  if (unit?.outcomes) parts.push(`<p><strong>Outcomes:</strong> ${escapeHtml(unit.outcomes)}</p>`);
  return parts.join('');
};

const getUnitRichText = (unit: any): string => (
  unit?.htmlContent
  || unit?.richTextContent
  || legacyUnitToHtml(unit)
);

const formatBook = (item: any): string => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return [item.title, item.author, item.publisher, item.edition].filter(Boolean).join(', ');
};

const formatOnlineResource = (item: any): string => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url ? [item.url, item.description].filter(Boolean).join(' - ') : '';
};

const formatCommonTo = (items: string[] = [], fallback: string) => {
  const cleanItems = items.map(item => String(item || '').trim()).filter(Boolean);
  if (cleanItems.length === 0) return `(For ${fallback})`;
  if (cleanItems.length === 1) return `(Common to ${cleanItems[0]})`;
  return `(Common to ${cleanItems.slice(0, -1).join(', ')} & ${cleanItems[cleanItems.length - 1]})`;
};

const getMappingValue = (mapping: any, key: string) => {
  const source = mapping instanceof Map ? Object.fromEntries(mapping.entries()) : mapping || {};
  const value = Number(source[key] || 0);
  return Number.isFinite(value) && value > 0 ? value : '';
};

const deriveColumns = (mappings: any[] = [], mapKey: 'po' | 'pso', prefix: string, fallbackCount: number) => {
  const maxFromMappings = mappings.reduce((max, mapping) => {
    const source = mapping?.[mapKey] instanceof Map
      ? Object.fromEntries(mapping[mapKey].entries())
      : mapping?.[mapKey] || {};
    Object.keys(source).forEach((key) => {
      const match = key.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      const value = Number(source[key] || 0);
      if (match && value > 0) max = Math.max(max, Number(match[1]));
    });
    return max;
  }, 0);
  const count = Math.max(fallbackCount, maxFromMappings);
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
};

interface PdfCoursePageProps {
  courseVersion: any;
  departmentName?: string;
  departmentCode?: string;
  regulationYear?: string | number;
  showLogo?: boolean;
  showFooter?: boolean;
  forcePageBreak?: boolean;
}

export const PdfCoursePageStyles = () => (
  <style>{`
    .obcp-pdf-course-page {
      width: 210mm;
      min-height: 297mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 17mm 18mm 16mm;
      background: #fff;
      color: #000;
      font-family: "Times New Roman", Times, serif;
      font-size: 10.5pt;
      line-height: 1.14;
      position: relative;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .obcp-pdf-course-page.force-page-break {
      break-before: page;
      page-break-before: always;
    }
    .obcp-pdf-course-logo {
      position: absolute;
      top: 10mm;
      right: 13mm;
      width: 24mm;
      height: auto;
    }
    .obcp-pdf-course-title {
      text-align: center;
      margin: 2mm 27mm 8mm;
      font-weight: 700;
    }
    .obcp-pdf-course-title h3 {
      margin: 0;
      font-size: 10.5pt;
      line-height: 1.1;
      font-weight: 700;
    }
    .obcp-pdf-course-title p {
      margin: 1mm 0 0;
      font-size: 9.5pt;
      font-weight: 700;
      line-height: 1.1;
    }
    .obcp-pdf-course-meta {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12mm;
      margin: 0 0 6mm;
      font-size: 10pt;
    }
    .obcp-pdf-ltpc {
      border-collapse: collapse;
      font-size: 10pt;
      font-weight: 700;
      line-height: 1;
      min-width: 35mm;
    }
    .obcp-pdf-ltpc th,
    .obcp-pdf-ltpc td {
      border: 0;
      padding: 0 3.2mm 1mm 0;
      text-align: center;
      font-weight: 700;
    }
    .obcp-pdf-section {
      margin: 0 0 5mm;
    }
    .obcp-pdf-section-title {
      margin: 0 0 1.5mm;
      font-weight: 700;
    }
    .obcp-pdf-outcomes {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.8pt;
      line-height: 1.12;
    }
    .obcp-pdf-outcomes td {
      border: 0;
      padding: 0.35mm 0;
      vertical-align: top;
    }
    .obcp-pdf-outcomes td:first-child {
      width: 12mm;
      padding-right: 1.2mm;
      font-weight: 700;
      white-space: nowrap;
    }
    .obcp-pdf-matrix {
      width: auto;
      min-width: 55%;
      max-width: 100%;
      margin: 2mm auto 0;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8.4pt;
      line-height: 1;
    }
    .obcp-pdf-matrix th,
    .obcp-pdf-matrix td {
      border: 1px solid #000;
      padding: 1.2mm 2mm;
      text-align: center;
      vertical-align: middle;
      min-width: 8mm;
      height: 4.5mm;
    }
    .obcp-pdf-matrix th,
    .obcp-pdf-matrix td:first-child {
      font-weight: 700;
    }
    .obcp-pdf-unit {
      margin: 7mm 0 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .obcp-pdf-unit-title {
      margin: 0 0 3.5mm;
      font-size: 10.5pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .obcp-pdf-unit-content,
    .obcp-pdf-reference-list {
      text-align: justify;
      font-size: 9.8pt;
      line-height: 1.13;
    }
    .obcp-pdf-unit-content p,
    .obcp-pdf-unit-content ul,
    .obcp-pdf-unit-content ol,
    .obcp-pdf-reference-list p {
      margin: 0 0 1.6mm;
    }
    .obcp-pdf-unit-content h1,
    .obcp-pdf-unit-content h2,
    .obcp-pdf-unit-content h3,
    .obcp-pdf-unit-content h4 {
      margin: 0 0 1.6mm;
      font-size: 10pt;
      line-height: 1.12;
      font-weight: 700;
    }
    .obcp-pdf-unit-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 2mm 0;
      font-size: 9pt;
    }
    .obcp-pdf-unit-content th,
    .obcp-pdf-unit-content td {
      border: 1px solid #000;
      padding: 1.2mm;
      vertical-align: top;
    }
    .obcp-pdf-reference-list {
      display: grid;
      grid-template-columns: 8mm 1fr;
      column-gap: 2mm;
      row-gap: 1.8mm;
      margin-left: 0;
    }
    .obcp-pdf-reference-index {
      text-align: center;
      font-weight: 700;
    }
    .obcp-pdf-course-footer {
      position: absolute;
      left: 18mm;
      right: 18mm;
      bottom: 8mm;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
    }
    @media print {
      .obcp-pdf-course-page {
        width: 210mm;
        min-height: 297mm;
        box-shadow: none !important;
      }
    }
  `}</style>
);

export const PdfCoursePage: React.FC<PdfCoursePageProps> = ({
  courseVersion,
  departmentName = 'Computer Science and Engineering',
  departmentCode = 'CSE',
  regulationYear = '2024',
  showLogo = true,
  showFooter = false,
  forcePageBreak = false,
}) => {
  const outcomes = courseVersion?.courseOutcomes || [];
  const poColumns = deriveColumns(courseVersion?.coPoMappings || [], 'po', 'PO', 11);
  const psoColumns = deriveColumns(courseVersion?.coPsoMappings || [], 'pso', 'PSO', 2);
  const visiblePsoColumns = courseVersion?.coPsoMappings?.length ? psoColumns : [];
  const units = courseVersion?.syllabusUnits || [];
  const textbooks = (courseVersion?.textbooks || []).map(formatBook).filter(Boolean);
  const referenceMaterials = (courseVersion?.referenceMaterials || []).map(formatBook).filter(Boolean);
  const onlineResources = (courseVersion?.onlineResources || []).map(formatOnlineResource).filter(Boolean);

  return (
    <section className={`obcp-pdf-course-page ${forcePageBreak ? 'force-page-break' : ''}`}>
      {showLogo && <img src={adityaLogo} alt="Aditya University" className="obcp-pdf-course-logo" />}

      <div className="obcp-pdf-course-title">
        <h3>{courseVersion?.courseId?.title || courseVersion?.title || 'Course Title'}</h3>
        <p>{formatCommonTo(courseVersion?.offeredFor || [], departmentName)}</p>
      </div>

      <div className="obcp-pdf-course-meta">
        <div>
          <strong>Course Code:</strong> {courseVersion?.courseId?.code || courseVersion?.code || '-'}
        </div>
        <table className="obcp-pdf-ltpc" aria-label="LTPC credits">
          <thead>
            <tr><th>L</th><th>T</th><th>P</th><th>C</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{courseVersion?.credits?.L ?? 0}</td>
              <td>{courseVersion?.credits?.T ?? 0}</td>
              <td>{courseVersion?.credits?.P ?? 0}</td>
              <td>{courseVersion?.credits?.C ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {outcomes.length > 0 && (
        <div className="obcp-pdf-section">
          <p className="obcp-pdf-section-title">Course Outcomes:</p>
          <p className="obcp-pdf-section-title">At the end of the course, student will be able to:</p>
          <table className="obcp-pdf-outcomes">
            <tbody>
              {outcomes.map((co: any) => (
                <tr key={co.coCode}>
                  <td>{co.coCode}:</td>
                  <td>{co.description || 'Outcome statement not yet defined.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {outcomes.length > 0 && (
        <div className="obcp-pdf-section">
          <p className="obcp-pdf-section-title">Mapping of Course Outcomes with Program Outcomes:</p>
          <table className="obcp-pdf-matrix">
            <thead>
              <tr>
                <th>CO/PO</th>
                {poColumns.map(column => <th key={column}>{column.replace('PO', 'PO ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {outcomes.map((co: any) => {
                const mapping = courseVersion?.coPoMappings?.find((item: any) => item.coCode === co.coCode)?.po || {};
                return (
                  <tr key={co.coCode}>
                    <td>{co.coCode}</td>
                    {poColumns.map(column => <td key={column}>{getMappingValue(mapping, column)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {outcomes.length > 0 && visiblePsoColumns.length > 0 && (
        <div className="obcp-pdf-section">
          <p className="obcp-pdf-section-title">Mapping of Course Outcomes with Program Specific Outcomes:</p>
          <table className="obcp-pdf-matrix">
            <thead>
              <tr>
                <th>CO/PSO</th>
                {visiblePsoColumns.map(column => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {outcomes.map((co: any) => {
                const mapping = courseVersion?.coPsoMappings?.find((item: any) => item.coCode === co.coCode)?.pso || {};
                return (
                  <tr key={co.coCode}>
                    <td>{co.coCode}</td>
                    {visiblePsoColumns.map(column => <td key={column}>{getMappingValue(mapping, column)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {units.map((unit: any, index: number) => (
        <div className="obcp-pdf-unit" key={unit.unitNumber || index}>
          <p className="obcp-pdf-unit-title">UNIT - {romanNumerals[index] || index + 1}</p>
          <div className="obcp-pdf-unit-content" dangerouslySetInnerHTML={{ __html: getUnitRichText(unit) }} />
        </div>
      ))}

      {textbooks.length > 0 && (
        <div className="obcp-pdf-unit">
          <p className="obcp-pdf-unit-title">Text Books:</p>
          <div className="obcp-pdf-reference-list">
            {textbooks.map((book: string, index: number) => (
              <React.Fragment key={`${book}-${index}`}>
                <span className="obcp-pdf-reference-index">{index + 1}</span>
                <span>{book}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {referenceMaterials.length > 0 && (
        <div className="obcp-pdf-unit">
          <p className="obcp-pdf-unit-title">Reference Books:</p>
          <div className="obcp-pdf-reference-list">
            {referenceMaterials.map((book: string, index: number) => (
              <React.Fragment key={`${book}-${index}`}>
                <span className="obcp-pdf-reference-index">{index + 1}</span>
                <span>{book}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {onlineResources.length > 0 && (
        <div className="obcp-pdf-unit">
          <p className="obcp-pdf-unit-title">Web Links:</p>
          <div className="obcp-pdf-reference-list">
            {onlineResources.map((resource: string, index: number) => (
              <React.Fragment key={`${resource}-${index}`}>
                <span className="obcp-pdf-reference-index">{index + 1}</span>
                <span>{resource}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {showFooter && (
        <div className="obcp-pdf-course-footer">
          <span>B. Tech ({departmentCode}) Curriculum-{regulationYear}</span>
          <span>Page</span>
        </div>
      )}
    </section>
  );
};

export default PdfCoursePage;
