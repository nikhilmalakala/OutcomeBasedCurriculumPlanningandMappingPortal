/**
 * curriculumDocxService.js
 * Generates a fully structured .docx curriculum book from live DB data.
 * Uses the `docx` npm package (already installed in backend/package.json).
 */

import fs from 'fs';
import path from 'path';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, AlignmentType, HeadingLevel, ImageRun,
  PageBreak, SectionType, convertInchesToTwip, convertMillimetersToTwip,
  Header, Footer, PageNumber, NumberFormat, TableLayoutType,
} from 'docx';
import CourseVersion from '../models/CourseVersion.js';
import Regulation from '../models/Regulation.js';
import MinorStream from '../models/MinorStream.js';
import CourseCategory from '../models/CourseCategory.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const CELL_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  left:   { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  right:  { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

const HEADER_SHADE = { fill: 'D1D5DB', type: 'clear' };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pt = (n) => n * 2; // half-points

const textRun = (text = '', opts = {}) => new TextRun({ text: String(text ?? ''), ...opts });

const boldRun = (text = '', opts = {}) => textRun(text, { bold: true, ...opts });

const cell = (children = [], opts = {}) => new TableCell({
  borders: CELL_BORDER,
  children: Array.isArray(children) ? children : [children],
  ...opts,
});

const headerCell = (text = '', span = 1, opts = {}) => new TableCell({
  borders: CELL_BORDER,
  shading: HEADER_SHADE,
  columnSpan: span,
  children: [new Paragraph({ children: [boldRun(text, { size: pt(9) })], alignment: AlignmentType.CENTER })],
  ...opts,
});

const dataCell = (text = '', opts = {}) => new TableCell({
  borders: CELL_BORDER,
  children: [new Paragraph({ children: [textRun(text, { size: pt(9) })], alignment: opts.align || AlignmentType.CENTER })],
  ...opts,
});

const sectionHeading = (text) => new Paragraph({
  children: [boldRun(text, { size: pt(13), color: '1D4ED8' })],
  heading: HeadingLevel.HEADING_2,
  alignment: AlignmentType.CENTER,
  spacing: { before: convertMillimetersToTwip(8), after: convertMillimetersToTwip(5) },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D4ED8' } },
  pageBreakBefore: true,
});

const subHeading = (text) => new Paragraph({
  children: [boldRun(text, { size: pt(11) })],
  heading: HeadingLevel.HEADING_3,
  spacing: { before: convertMillimetersToTwip(5), after: convertMillimetersToTwip(3) },
});

const emptyPara = (lines = 1) => Array.from({ length: lines }, () =>
  new Paragraph({ children: [textRun('')], spacing: { after: 0 } })
);

const stripHtml = (html = '') => String(html)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s{2,}/g, ' ')
  .trim();

const getCourseLevelCode = (v) => {
  const raw = `${v.level || v.knowledgeLevel || ''}`.toLowerCase();
  if (raw === 'advanced'     || raw === 'ac') return 'AC';
  if (raw === 'intermediate' || raw === 'ic') return 'IC';
  return 'FC';
};

const fmtC = (val) => (val === 0 || !val) ? '-' : String(val);

const formatBookEntry = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return [item.title, item.author, item.publisher, item.edition].filter(Boolean).join(', ');
};

const getLogoBuffer = () => {
  const candidates = [
    path.resolve('frontend', 'src', 'assets', 'aditya-logo.png'),
    path.resolve('..', 'frontend', 'src', 'assets', 'aditya-logo.png'),
  ];
  const found = candidates.find(c => fs.existsSync(c));
  return found ? fs.readFileSync(found) : null;
};

const getMappingValue = (mapping, key) => {
  const source = mapping instanceof Map ? Object.fromEntries(mapping.entries()) : (mapping || {});
  const value = Number(source[key] || 0);
  return (Number.isFinite(value) && value > 0) ? String(value) : '-';
};

const deriveMappingColumns = (mappings = [], mapKey, prefix, fallback) => {
  const maxN = mappings.reduce((max, m) => {
    const src = m?.[mapKey] instanceof Map ? Object.fromEntries(m[mapKey].entries()) : (m?.[mapKey] || {});
    Object.entries(src).forEach(([k, v]) => {
      const match = k.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      if (match && Number(v || 0) > 0) max = Math.max(max, Number(match[1]));
    });
    return max;
  }, 0);
  const count = Math.max(fallback, maxN);
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
};

// ─── TABLE BUILDERS ───────────────────────────────────────────────────────────

/** Credit Division Table */
const buildCreditDivisionTable = (dbCategories, categoryTotals, programTotalCredits) => {
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  const getRowCredits = (code) => {
    if (code === 'MSC/UEC') return (categoryTotals['MSC'] || 0) + (categoryTotals['UEC'] || 0);
    return categoryTotals[code] || 0;
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('S.No',  1, { width: { size: 10, type: WidthType.PERCENTAGE } }),
          headerCell('Broad Category of Course', 1, { width: { size: 55, type: WidthType.PERCENTAGE } }),
          headerCell('UGC',     1, { width: { size: 20, type: WidthType.PERCENTAGE } }),
          headerCell('Credits', 1, { width: { size: 15, type: WidthType.PERCENTAGE } }),
        ],
      }),
      ...dbCategories.map((cat, idx) => new TableRow({
        children: [
          dataCell(String(idx + 1)),
          dataCell(cat.name || cat.code, { align: AlignmentType.LEFT }),
          dataCell(cat.ugc || '-'),
          dataCell(String(getRowCredits(cat.code) || '')),
        ],
      })),
      // Total row
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            columnSpan: 2,
            children: [new Paragraph({ children: [boldRun('Total Credits to be earned for B. Tech Degree', { size: pt(9) })], alignment: AlignmentType.LEFT })],
          }),
          dataCell(String(programTotalCredits)),
          dataCell(String(grandTotal || programTotalCredits)),
        ],
      }),
    ],
  });
};

/** Category-wise Course Listing Table */
const buildCategoryTable = (title, rows) => {
  const totals = rows.reduce((acc, v) => {
    acc.L += v.credits?.L || 0; acc.T += v.credits?.T || 0;
    acc.P += v.credits?.P || 0; acc.S += v.credits?.S || 0; acc.C += v.credits?.C || 0;
    return acc;
  }, { L: 0, T: 0, P: 0, S: 0, C: 0 });

  const colWidths = [10, 30, 6, 6, 6, 6, 6, 6, 8, 8, 8];
  return [
    subHeading(title),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Course Code', 1, { width: { size: colWidths[0], type: WidthType.PERCENTAGE } }),
            headerCell('Course Name',  1, { width: { size: colWidths[1], type: WidthType.PERCENTAGE } }),
            headerCell('Level', 1, { width: { size: colWidths[2], type: WidthType.PERCENTAGE } }),
            headerCell('L',     1, { width: { size: colWidths[3], type: WidthType.PERCENTAGE } }),
            headerCell('T',     1, { width: { size: colWidths[4], type: WidthType.PERCENTAGE } }),
            headerCell('P',     1, { width: { size: colWidths[5], type: WidthType.PERCENTAGE } }),
            headerCell('S',     1, { width: { size: colWidths[6], type: WidthType.PERCENTAGE } }),
            headerCell('C',     1, { width: { size: colWidths[7], type: WidthType.PERCENTAGE } }),
            headerCell('CIE',   1, { width: { size: colWidths[8], type: WidthType.PERCENTAGE } }),
            headerCell('SEE',   1, { width: { size: colWidths[9], type: WidthType.PERCENTAGE } }),
            headerCell('Total', 1, { width: { size: colWidths[10], type: WidthType.PERCENTAGE } }),
          ],
        }),
        ...rows.map(v => {
          const cie = v.cieSee?.cieMaxMarks || 50;
          const see = v.cieSee?.seeMaxMarks || 50;
          return new TableRow({
            children: [
              dataCell(v.courseId?.code || '-'),
              dataCell(v.courseId?.title || '-', { align: AlignmentType.LEFT }),
              dataCell(getCourseLevelCode(v)),
              dataCell(fmtC(v.credits?.L)),
              dataCell(fmtC(v.credits?.T)),
              dataCell(fmtC(v.credits?.P)),
              dataCell(fmtC(v.credits?.S)),
              dataCell(fmtC(v.credits?.C)),
              dataCell(String(cie)),
              dataCell(String(see)),
              dataCell(String(cie + see)),
            ],
          });
        }),
        // Totals row
        new TableRow({
          children: [
            new TableCell({ borders: CELL_BORDER, columnSpan: 3, children: [new Paragraph({ children: [boldRun('Total', { size: pt(9) })], alignment: AlignmentType.CENTER })] }),
            dataCell(fmtC(totals.L)),
            dataCell(fmtC(totals.T)),
            dataCell(fmtC(totals.P)),
            dataCell(fmtC(totals.S)),
            dataCell(fmtC(totals.C)),
            new TableCell({ borders: CELL_BORDER, columnSpan: 3, children: [new Paragraph({ children: [textRun('')], alignment: AlignmentType.CENTER })] }),
          ],
        }),
      ],
    }),
    ...emptyPara(1),
  ];
};

/** Semester-wise Structure Table */
const buildSemesterTable = (semNum, semCourses) => {
  const totals = semCourses.reduce((acc, v) => {
    acc.L += v.credits?.L || 0; acc.T += v.credits?.T || 0;
    acc.P += v.credits?.P || 0; acc.S += v.credits?.S || 0; acc.C += v.credits?.C || 0;
    return acc;
  }, { L: 0, T: 0, P: 0, S: 0, C: 0 });

  return [
    subHeading(`Semester ${semNum}`),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Course Code',  1, { width: { size: 12, type: WidthType.PERCENTAGE } }),
            headerCell('Course Title', 1, { width: { size: 35, type: WidthType.PERCENTAGE } }),
            headerCell('Category',     1, { width: { size: 9,  type: WidthType.PERCENTAGE } }),
            headerCell('L',  1, { width: { size: 8, type: WidthType.PERCENTAGE } }),
            headerCell('T',  1, { width: { size: 8, type: WidthType.PERCENTAGE } }),
            headerCell('P',  1, { width: { size: 8, type: WidthType.PERCENTAGE } }),
            headerCell('S',  1, { width: { size: 8, type: WidthType.PERCENTAGE } }),
            headerCell('C',  1, { width: { size: 12, type: WidthType.PERCENTAGE } }),
          ],
        }),
        ...semCourses.map(v => new TableRow({
          children: [
            dataCell(v.courseId?.code || '-'),
            dataCell(v.courseId?.title || '-', { align: AlignmentType.LEFT }),
            dataCell(v.category || '-'),
            dataCell(fmtC(v.credits?.L)),
            dataCell(fmtC(v.credits?.T)),
            dataCell(fmtC(v.credits?.P)),
            dataCell(fmtC(v.credits?.S)),
            dataCell(fmtC(v.credits?.C)),
          ],
        })),
        new TableRow({
          children: [
            new TableCell({ borders: CELL_BORDER, columnSpan: 3, children: [new Paragraph({ children: [boldRun('Total', { size: pt(9) })], alignment: AlignmentType.CENTER })] }),
            dataCell(fmtC(totals.L)),
            dataCell(fmtC(totals.T)),
            dataCell(fmtC(totals.P)),
            dataCell(fmtC(totals.S)),
            dataCell(fmtC(totals.C)),
          ],
        }),
      ],
    }),
    ...emptyPara(1),
  ];
};

/** CO-PO / CO-PSO Mapping Matrix Table */
const buildMappingTable = (label, outcomes, mappings, columns, mapKey) => {
  if (!outcomes.length || !columns.length) return [];

  const firstColWidth = 15;
  const otherColWidth = Math.floor(85 / columns.length);

  return [
    new Paragraph({
      children: [boldRun(label, { size: pt(9) })],
      spacing: { before: convertMillimetersToTwip(3), after: convertMillimetersToTwip(1) },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell(`CO/${mapKey.toUpperCase()}`, 1, { width: { size: firstColWidth, type: WidthType.PERCENTAGE } }),
            ...columns.map(col => headerCell(col, 1, { width: { size: otherColWidth, type: WidthType.PERCENTAGE } })),
          ],
        }),
        ...outcomes.map(co => {
          const mapping = mappings.find(m => m.coCode === co.coCode)?.[mapKey] || {};
          return new TableRow({
            children: [
              dataCell(co.coCode, { width: { size: firstColWidth, type: WidthType.PERCENTAGE } }),
              ...columns.map(col => dataCell(getMappingValue(mapping, col), { width: { size: otherColWidth, type: WidthType.PERCENTAGE } })),
            ],
          });
        }),
      ],
    }),
    ...emptyPara(1),
  ];
};

/** Individual Course Page */
const buildCourseSection = (v) => {
  const outcomes      = v.courseOutcomes || [];
  const units         = v.syllabusUnits  || [];
  const textbooks     = (v.textbooks         || []).map(formatBookEntry).filter(Boolean);
  const refBooks      = (v.referenceMaterials || []).map(formatBookEntry).filter(Boolean);
  const onlineRes     = (v.onlineResources    || []).map(item => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.url ? [item.url, item.description].filter(Boolean).join(' – ') : '';
  }).filter(Boolean);

  const poColumns  = deriveMappingColumns(v.coPoMappings  || [], 'po',  'PO',  11);
  const psoColumns = (v.coPsoMappings || []).length
    ? deriveMappingColumns(v.coPsoMappings || [], 'pso', 'PSO', 2)
    : [];

  const courseTitle = v.courseId?.title || 'Course Title';
  const courseCode  = v.courseId?.code  || '-';
  const L = fmtC(v.credits?.L), T = fmtC(v.credits?.T),
        P = fmtC(v.credits?.P), S = fmtC(v.credits?.S), C = fmtC(v.credits?.C);

  const items = [
    // Page break + course title
    new Paragraph({
      children: [new PageBreak(), boldRun(courseTitle, { size: pt(11) })],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertMillimetersToTwip(2), after: convertMillimetersToTwip(2) },
    }),
    // Code + LTPC in a 2-column table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              width: { size: 60, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [boldRun('Course Code: ', { size: pt(10) }), textRun(courseCode, { size: pt(10) })] })],
            }),
            new TableCell({
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              width: { size: 40, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [boldRun(`L:${L}  T:${T}  P:${P}  S:${S}  C:${C}`, { size: pt(10) })], alignment: AlignmentType.RIGHT })],
            }),
          ],
        }),
      ],
    }),
    ...emptyPara(1),
  ];

  // Course Outcomes
  if (outcomes.length) {
    items.push(
      new Paragraph({ children: [boldRun('Course Outcomes:', { size: pt(10) })], spacing: { after: convertMillimetersToTwip(1) } }),
      new Paragraph({ children: [boldRun('At the end of the course, student will be able to:', { size: pt(9) })], spacing: { after: convertMillimetersToTwip(1) } }),
    );
    outcomes.forEach(co => {
      items.push(new Paragraph({
        children: [boldRun(`${co.coCode}: `, { size: pt(9) }), textRun(co.description || 'Outcome statement not defined.', { size: pt(9) })],
        spacing: { after: convertMillimetersToTwip(1) },
      }));
    });
    items.push(...emptyPara(1));

    // CO-PO table
    items.push(...buildMappingTable('Mapping of Course Outcomes with Program Outcomes:', outcomes, v.coPoMappings || [], poColumns, 'po'));

    // CO-PSO table
    if (psoColumns.length) {
      items.push(...buildMappingTable('Mapping of Course Outcomes with Program Specific Outcomes:', outcomes, v.coPsoMappings || [], psoColumns, 'pso'));
    }
  }

  // Syllabus Units
  units.forEach((unit, i) => {
    const unitContent = stripHtml(unit.htmlContent || unit.richTextContent || unit.description || '');
    items.push(
      new Paragraph({
        children: [boldRun(`UNIT – ${ROMAN[i] || i + 1}`, { size: pt(10), allCaps: true })],
        spacing: { before: convertMillimetersToTwip(4), after: convertMillimetersToTwip(2) },
      }),
    );
    if (unit.title) items.push(new Paragraph({ children: [boldRun(unit.title, { size: pt(9) })], spacing: { after: convertMillimetersToTwip(1) } }));
    if (unitContent) {
      unitContent.split(/\n+/).filter(Boolean).forEach(line => {
        items.push(new Paragraph({ children: [textRun(line, { size: pt(9) })], spacing: { after: convertMillimetersToTwip(1) } }));
      });
    }
  });

  // References
  const buildRefList = (title, entries) => {
    if (!entries.length) return [];
    return [
      new Paragraph({ children: [boldRun(title, { size: pt(10), allCaps: true })], spacing: { before: convertMillimetersToTwip(4), after: convertMillimetersToTwip(2) } }),
      ...entries.map((entry, i) => new Paragraph({
        children: [boldRun(`${i + 1}. `, { size: pt(9) }), textRun(entry, { size: pt(9) })],
        spacing: { after: convertMillimetersToTwip(1) },
      })),
    ];
  };

  items.push(
    ...buildRefList('Text Books:', textbooks),
    ...buildRefList('Reference Books:', refBooks),
    ...buildRefList('Web Links:', onlineRes),
  );

  return items;
};

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * generateCurriculumDocx
 * @param {object} options
 * @param {string} options.regulationId
 * @param {string} options.departmentId
 * @param {string} options.departmentName
 * @param {string} options.departmentCode
 * @param {string} options.programName
 * @param {string} options.programCode
 * @param {number} options.programTotalCredits
 * @returns {Promise<Buffer>} DOCX binary buffer
 */
export const generateCurriculumDocx = async ({
  regulationId,
  departmentId,
  departmentName = 'Computer Science and Engineering',
  departmentCode = 'CSE',
  programName    = 'B. Tech. Four Year Degree Program',
  programCode    = 'B.Tech',
  programTotalCredits = 160,
}) => {
  // ── Fetch live data ──
  const regulation = await Regulation.findById(regulationId).lean();
  if (!regulation) throw new Error('Regulation not found.');

  const regulationCode = regulation.code || 'R24';
  const academicYear   = regulation.academicYear || '2024';
  const semesterCount  = regulation.semesterCount || 8;

  const allVersions = await CourseVersion.find({ regulationId })
    .populate({ path: 'courseId', populate: { path: 'departmentId' } })
    .sort({ semester: 1, 'courseId.code': 1 })
    .lean();

  const courses = departmentId
    ? allVersions.filter(v => {
        const dId = String(v.courseId?.departmentId?._id || v.courseId?.departmentId || '');
        return dId === departmentId || v.category === 'UEC';
      })
    : allVersions;

  const minorStreams = departmentId
    ? await MinorStream.find({ regulationId, departmentId })
        .populate({ path: 'courses', model: 'Course', populate: { path: 'departmentId' } })
        .sort({ name: 1 }).lean()
    : [];

  const dbCategories = await CourseCategory.find().lean();

  // Category credit totals
  const categoryTotals = courses.reduce((acc, v) => {
    const cat = v.category || 'MCC';
    acc[cat] = (acc[cat] || 0) + (v.credits?.C || 0);
    return acc;
  }, {});

  // ── Logo ──
  const logoBuffer = getLogoBuffer();

  // ── Header / Footer ──
  const makeHeader = () => new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: '374151' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                width: { size: 75, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [boldRun(`Department of ${departmentName}`, { size: pt(8.5), color: '374151' })] }),
                  new Paragraph({ children: [textRun(`${programCode} Program Curriculum-${academicYear}`, { size: pt(8.5), color: '374151' })] }),
                ],
              }),
              new TableCell({
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: logoBuffer ? [
                  new Paragraph({
                    children: [new ImageRun({ data: logoBuffer, transformation: { width: 90, height: 30 } })],
                    alignment: AlignmentType.RIGHT,
                  }),
                ] : [new Paragraph({ children: [] })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const makeFooter = () => new Footer({
    children: [
      new Paragraph({
        children: [
          textRun(`${programCode} (${departmentCode}) Curriculum-${academicYear}     `, { size: pt(9), color: '374151' }),
          textRun('Page ', { size: pt(9), color: '374151' }),
          new TextRun({ children: [PageNumber.CURRENT], size: pt(9), color: '374151' }),
          textRun('     Aditya University', { size: pt(9), color: '374151' }),
        ],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: '374151' } },
      }),
    ],
  });

  // ─────────────────────────────────────────────────────────
  //  SECTION 1: COVER PAGE
  // ─────────────────────────────────────────────────────────
  const coverChildren = [
    ...(logoBuffer ? [
      new Paragraph({
        children: [new ImageRun({ data: logoBuffer, transformation: { width: 220, height: 70 } })],
        alignment: AlignmentType.CENTER,
        spacing: { before: convertMillimetersToTwip(30), after: convertMillimetersToTwip(10) },
      }),
    ] : []),
    new Paragraph({
      children: [boldRun('PROGRAM CURRICULUM', { size: pt(26), color: '111827', allCaps: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(4) },
    }),
    new Paragraph({
      children: [textRun('for', { size: pt(12), color: '374151' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(2) },
    }),
    new Paragraph({
      children: [boldRun(programName.toUpperCase(), { size: pt(18), color: '991B1B', allCaps: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(3) },
    }),
    new Paragraph({
      children: [textRun(`(Applicable for the batches admitted from A.Y. ${academicYear}-${String(Number(academicYear) + 1).slice(-2)})`, { size: pt(11), color: '374151' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(20) },
    }),
    new Paragraph({
      children: [boldRun(departmentName.toUpperCase(), { size: pt(18), color: '991B1B', allCaps: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(3) },
    }),
    new Paragraph({
      children: [boldRun(`${regulationCode} Curriculum`, { size: pt(12), color: '374151' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(30) },
    }),
    new Paragraph({
      children: [textRun('Aditya Nagar, ADB Road, Surampalem - 533 437', { size: pt(11), color: '374151' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(2) },
    }),
    new Paragraph({
      children: [boldRun('Aditya University', { size: pt(12), color: '374151' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(2) },
    }),
    new Paragraph({
      children: [textRun("Accredited by NAAC with 'A++' Grade – Approved by AICTE", { size: pt(10), color: '374151', italics: true })],
      alignment: AlignmentType.CENTER,
    }),
  ];

  // ─────────────────────────────────────────────────────────
  //  SECTION 2: CREDIT DIVISION
  // ─────────────────────────────────────────────────────────
  const creditSection = [
    sectionHeading('Credit Division Category-wise'),
    new Paragraph({
      children: [
        boldRun('Foundation Courses – FC  |  ', { size: pt(10) }),
        boldRun('Intermediate-level Courses – IC  |  ', { size: pt(10) }),
        boldRun('Advanced Courses – AC', { size: pt(10) }),
      ],
      spacing: { after: convertMillimetersToTwip(4) },
    }),
    buildCreditDivisionTable(dbCategories, categoryTotals, programTotalCredits),
    ...emptyPara(1),
  ];

  // ─────────────────────────────────────────────────────────
  //  SECTION 3: CATEGORY-WISE COURSE TABLES
  // ─────────────────────────────────────────────────────────
  const categoryTablesSection = [
    sectionHeading('Category-wise Course Structure'),
    ...dbCategories.flatMap(cat => {
      const rows = courses.filter(v => (v.category || 'MCC') === cat.code);
      if (!rows.length) return [];
      return buildCategoryTable(cat.name || cat.code, rows);
    }),
  ];

  // ─────────────────────────────────────────────────────────
  //  SECTION 4: SEMESTER-WISE STRUCTURE
  // ─────────────────────────────────────────────────────────
  const semesterSection = [
    sectionHeading('Semester-wise Course Structure'),
    ...Array.from({ length: semesterCount }, (_, i) => {
      const semNum = i + 1;
      const semCourses = courses.filter(v => v.semester === semNum);
      if (!semCourses.length) return [];
      return buildSemesterTable(semNum, semCourses);
    }).flat(),
  ];

  // ─────────────────────────────────────────────────────────
  //  SECTION 5: MINOR STREAMS
  // ─────────────────────────────────────────────────────────
  const minorSection = minorStreams.length ? [
    sectionHeading('Minor Stream Course Details'),
    ...minorStreams.flatMap(stream => {
      const streamCourses = stream.courses || [];
      return [
        subHeading(`Minor Stream: ${stream.name}`),
        ...(streamCourses.length ? buildCategoryTable(stream.name, streamCourses.map(c => ({
          courseId: { code: c.code, title: c.title },
          category: 'MSC',
          level: '',
          credits: { L: 0, T: 0, P: 0, S: 0, C: 0 },
          cieSee: { cieMaxMarks: 50, seeMaxMarks: 50 },
        }))) : [new Paragraph({ children: [textRun('No courses assigned to this minor stream yet.', { size: pt(9), italics: true })] })]),
      ];
    }),
  ] : [];

  // ─────────────────────────────────────────────────────────
  //  SECTION 6: INDIVIDUAL COURSE PAGES
  // ─────────────────────────────────────────────────────────
  const coursesSectionHeading = [sectionHeading('Detailed Course Syllabi')];
  const coursePagesChildren = courses.flatMap(v => buildCourseSection(v));

  // ── Assemble Document ──
  const doc = new Document({
    numbering: undefined,
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: pt(10.5), color: '0a0a0a' },
        },
      },
    },
    sections: [
      // Cover (no header/footer)
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: { orientation: 'portrait' } },
        },
        children: coverChildren,
      },
      // Main content sections (with header/footer)
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: { orientation: 'portrait' }, margin: { top: convertMillimetersToTwip(28), bottom: convertMillimetersToTwip(24), left: convertMillimetersToTwip(18), right: convertMillimetersToTwip(18) } },
        },
        headers: { default: makeHeader() },
        footers: { default: makeFooter() },
        children: [
          ...creditSection,
          ...categoryTablesSection,
          ...semesterSection,
          ...minorSection,
          ...coursesSectionHeading,
          ...coursePagesChildren,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
};
