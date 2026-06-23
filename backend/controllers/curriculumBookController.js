import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mongoose from 'mongoose';
import puppeteer from 'puppeteer';
import CurriculumBook from '../models/CurriculumBook.js';
import CurriculumVersion from '../models/CurriculumVersion.js';
import CurriculumSection from '../models/CurriculumSection.js';
import CourseVersion from '../models/CourseVersion.js';
import Regulation from '../models/Regulation.js';
import MinorStream from '../models/MinorStream.js';
import Course from '../models/Course.js';
import CourseCategory from '../models/CourseCategory.js';
import Department from '../models/Department.js';
import Program from '../models/Program.js';
import { generateCurriculumDocx } from '../services/curriculumDocxService.js';

const STATUS_VALUES = ['Draft', 'Published', 'Archived'];
const GENERATED_DIR = path.resolve('uploads', 'generated');

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const stripUnsafeHtml = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");
};

const escHtml = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const textToHtml = (text = '') => escHtml(text)
  .split(/\n{2,}/)
  .map(block => block.trim())
  .filter(Boolean)
  .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
  .join('\n');

const getFileType = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || ext === '.pdf') return 'PDF';
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') return 'DOCX';
  return null;
};

const getLogoBase64 = () => {
  const candidates = [
    path.resolve('frontend', 'src', 'assets', 'aditya-logo.png'),
    path.resolve('..', 'frontend', 'src', 'assets', 'aditya-logo.png'),
  ];
  const logoPath = candidates.find(c => fs.existsSync(c));
  if (!logoPath) return '';
  const buffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
};

const extractUploadHtml = async (file, fileType) => {
  if (fileType !== 'PDF') return '';
  try {
    const buffer = await fs.promises.readFile(file.path);
    const parsed = await pdfParse(buffer);
    return textToHtml(parsed.text || '');
  } catch (error) {
    console.warn('[CurriculumBook] PDF text extraction failed:', error.message);
    return '';
  }
};

const sanitizeSectionContent = (content = {}) => {
  if (typeof content === 'string') return stripUnsafeHtml(content);
  if (!content || typeof content !== 'object') return content;
  return Object.entries(content).reduce((safe, [key, value]) => {
    if (typeof value === 'string') {
      safe[key] = ['html', 'richTextContent', 'vision', 'mission', 'body'].includes(key)
        ? stripUnsafeHtml(value) : value;
    } else if (Array.isArray(value)) {
      safe[key] = value.map(item => sanitizeSectionContent(item));
    } else if (value && typeof value === 'object') {
      safe[key] = sanitizeSectionContent(value);
    } else {
      safe[key] = value;
    }
    return safe;
  }, {});
};

const normalizeSection = (section, index) => ({
  sectionType: section.sectionType || 'Custom',
  sectionTitle: section.sectionTitle || `Section ${index + 1}`,
  sectionContent: sanitizeSectionContent(section.sectionContent || { html: '' }),
  orderNumber: Number.isFinite(Number(section.orderNumber)) ? Number(section.orderNumber) : index + 1,
});

const buildInitialSections = (curriculumBookId, extractedHtml) => {
  const sections = [];
  if (!extractedHtml) {
    sections.push({ curriculumBookId, sectionType: 'DocumentBody', sectionTitle: 'Editable Curriculum Book', sectionContent: { html: '' }, orderNumber: 1 });
  } else {
    const paragraphs = extractedHtml.split('\n');
    let currentHtml = '';
    let partNum = 1;
    const MAX_CHUNK_LENGTH = 15000;
    for (const p of paragraphs) {
      if (currentHtml.length + p.length > MAX_CHUNK_LENGTH && currentHtml.length > 0) {
        sections.push({ curriculumBookId, sectionType: 'DocumentBody', sectionTitle: `Book Content (Part ${partNum})`, sectionContent: { html: currentHtml }, orderNumber: partNum });
        currentHtml = '';
        partNum++;
      }
      currentHtml += (currentHtml ? '\n' : '') + p;
    }
    if (currentHtml) {
      sections.push({ curriculumBookId, sectionType: 'DocumentBody', sectionTitle: partNum === 1 ? 'Editable Curriculum Book' : `Book Content (Part ${partNum})`, sectionContent: { html: currentHtml }, orderNumber: partNum });
    }
  }
  sections.push({ curriculumBookId, sectionType: 'ProgramInfo', sectionTitle: 'Department Vision and Mission', sectionContent: { vision: '', mission: '' }, orderNumber: sections.length + 1 });
  return sections;
};

const snapshotFor = async (book) => {
  const sections = await CurriculumSection.find({ curriculumBookId: book._id }).sort({ orderNumber: 1 }).lean();
  return {
    book: book.toObject ? book.toObject() : book,
    sections: sections.map(section => ({
      sectionType: section.sectionType, sectionTitle: section.sectionTitle,
      sectionContent: section.sectionContent, orderNumber: section.orderNumber,
    })),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  DYNAMIC CONTEXT LOADER
// ─────────────────────────────────────────────────────────────────────────────
const getDynamicCurriculumContext = async (book) => {
  const regulationCode = book.regulation || '';
  const regulation = await Regulation.findOne({ code: regulationCode })
    .populate('programId').lean();

  if (!regulation?._id) {
    return { regulation: null, courses: [], minorStreams: [], peoPso: null };
  }

  const departmentId = String(book.departmentId?._id || book.departmentId || '');
  const versions = await CourseVersion.find({ regulationId: regulation._id })
    .populate({ path: 'courseId', populate: { path: 'departmentId' } })
    .sort({ semester: 1, 'courseId.code': 1 })
    .lean();

  const courses = departmentId
    ? versions.filter(version => {
        const courseDeptId = String(version.courseId?.departmentId?._id || version.courseId?.departmentId || '');
        return courseDeptId === departmentId || version.category === 'UEC';
      })
    : versions;

  const minorStreams = departmentId
    ? await MinorStream.find({ regulationId: regulation._id, departmentId })
        .populate({
          path: 'courses',
          model: 'Course',
          populate: { path: 'departmentId' }
        })
        .sort({ name: 1 }).lean()
    : [];

  const dbCategories = await CourseCategory.find().lean();

  return { regulation, courses, minorStreams, dbCategories };
};

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER RENDERERS
// ─────────────────────────────────────────────────────────────────────────────
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const getMapValue = (mapping, key) => {
  const source = mapping instanceof Map ? Object.fromEntries(mapping.entries()) : mapping || {};
  const value = Number(source[key] || 0);
  return Number.isFinite(value) && value > 0 ? value : '-';
};

const deriveMappingColumns = (mappings = [], mapKey, prefix, fallbackCount) => {
  const maxFromMappings = mappings.reduce((max, mapping) => {
    const source = mapping?.[mapKey] instanceof Map ? Object.fromEntries(mapping[mapKey].entries()) : mapping?.[mapKey] || {};
    Object.entries(source).forEach(([key, rawValue]) => {
      const match = key.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      if (match && Number(rawValue || 0) > 0) max = Math.max(max, Number(match[1]));
    });
    return max;
  }, 0);
  const count = Math.max(fallbackCount, maxFromMappings);
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
};

const formatCommonTo = (items = [], fallback) => {
  const clean = items.map(item => String(item || '').trim()).filter(Boolean);
  if (clean.length === 0) return `(For ${fallback})`;
  if (clean.length === 1) return `(Common to ${clean[0]})`;
  return `(Common to ${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]})`;
};

const getCourseLevelCode = (version) => {
  const raw = `${version.level || version.knowledgeLevel || ''}`.toLowerCase();
  if (raw === 'advanced' || raw === 'ac') return 'AC';
  if (raw === 'intermediate' || raw === 'ic') return 'IC';
  return 'FC'; // Foundation / default
};

const getCategoryCreditTotal = (categoryTotals, code) => categoryTotals[code] || 0;

const legacyUnitToHtml = (unit = {}) => {
  const parts = [];
  if (unit.title) parts.push(`<p><strong>${escHtml(unit.title)}</strong></p>`);
  if (unit.description) parts.push(`<p>${escHtml(unit.description).replace(/\n/g, '<br>')}</p>`);
  if (Array.isArray(unit.topics) && unit.topics.some(t => String(t || '').trim())) {
    parts.push(`<p>${escHtml(unit.topics.filter(Boolean).join(', '))}</p>`);
  }
  if (unit.outcomes) parts.push(`<p><strong>Outcomes:</strong> ${escHtml(unit.outcomes)}</p>`);
  return parts.join('');
};

const getUnitHtml = (unit = {}) => stripUnsafeHtml(unit.htmlContent || unit.richTextContent || legacyUnitToHtml(unit));

const formatBookEntry = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return [item.title, item.author, item.publisher, item.edition].filter(Boolean).join(', ');
};

const formatOnlineEntry = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url ? [item.url, item.description].filter(Boolean).join(' - ') : '';
};

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION-TO-HTML (for static curriculum book sections)
// ─────────────────────────────────────────────────────────────────────────────
const sectionToHtml = (section) => {
  const content = section.sectionContent || {};
  const title = escHtml(section.sectionTitle || 'Untitled Section');

  if (typeof content === 'string') {
    return `<div class="cs-section"><h2 class="cs-h2">${title}</h2><div class="rich">${stripUnsafeHtml(content)}</div></div>`;
  }

  if (content.html || content.richTextContent || content.body) {
    return `<div class="cs-section"><h2 class="cs-h2">${title}</h2><div class="rich">${stripUnsafeHtml(content.html || content.richTextContent || content.body)}</div></div>`;
  }

  if (content.vision || content.mission) {
    return `
      <div class="cs-section">
        <h2 class="cs-h2">${title}</h2>
        <h3 class="cs-h3">Vision of the Department</h3>
        <div class="rich">${textToHtml(content.vision || '')}</div>
        <h3 class="cs-h3">Mission of the Department</h3>
        <div class="rich">${textToHtml(content.mission || '')}</div>
      </div>
    `;
  }

  return `
    <div class="cs-section">
      <h2 class="cs-h2">${title}</h2>
      <table class="std-table"><tbody>
        ${Object.entries(content).map(([key, value]) => `
          <tr><th>${escHtml(key)}</th><td>${escHtml(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</td></tr>
        `).join('')}
      </tbody></table>
    </div>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
//  COURSE PAGE — EXACT MATCH OF PDF FORMAT
// ─────────────────────────────────────────────────────────────────────────────
const renderCoursePageHtml = (version, departmentName) => {
  const outcomes = version.courseOutcomes || [];
  const poColumns = deriveMappingColumns(version.coPoMappings || [], 'po', 'PO', 11);
  const psoColumns = (version.coPsoMappings || []).length
    ? deriveMappingColumns(version.coPsoMappings || [], 'pso', 'PSO', 2)
    : [];
  const courseTitle = escHtml(version.courseId?.title || 'Course Title');
  const courseCode = escHtml(version.courseId?.code || '-');
  const commonToText = escHtml(formatCommonTo(version.offeredFor || [], departmentName));
  const L = version.credits?.L ?? 0;
  const T = version.credits?.T ?? 0;
  const P = version.credits?.P ?? 0;
  const S = version.credits?.S ?? 0;
  const C = version.credits?.C ?? 0;

  // CO-PO Mapping table
  const coPoTable = outcomes.length > 0 ? `
    <div class="cp-section">
      <p class="cp-section-label">Mapping of Course Outcomes with Program Outcomes:</p>
      <table class="cp-matrix">
        <thead><tr>
          <th>CO/PO</th>
          ${poColumns.map(col => `<th>${col.replace('PO', 'PO ')}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${outcomes.map(co => {
            const mapping = (version.coPoMappings || []).find(m => m.coCode === co.coCode)?.po || {};
            return `<tr>
              <td class="cp-co-label">${escHtml(co.coCode)}</td>
              ${poColumns.map(col => `<td>${getMapValue(mapping, col)}</td>`).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  // CO-PSO Mapping table
  const coPsoTable = outcomes.length > 0 && psoColumns.length > 0 ? `
    <div class="cp-section">
      <p class="cp-section-label">Mapping of Course Outcomes with Program Specific Outcomes:</p>
      <table class="cp-matrix">
        <thead><tr>
          <th>CO/PSO</th>
          ${psoColumns.map(col => `<th>${col}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${outcomes.map(co => {
            const mapping = (version.coPsoMappings || []).find(m => m.coCode === co.coCode)?.pso || {};
            return `<tr>
              <td class="cp-co-label">${escHtml(co.coCode)}</td>
              ${psoColumns.map(col => `<td>${getMapValue(mapping, col)}</td>`).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  // Syllabus Units
  const unitsHtml = (version.syllabusUnits || []).map((unit, i) => `
    <div class="cp-unit">
      <p class="cp-unit-title">UNIT – ${ROMAN[i] || i + 1}</p>
      <div class="cp-unit-body">${getUnitHtml(unit)}</div>
    </div>
  `).join('');

  // Text Books
  const textbooks = version.textbooks || [];
  const refBooks = version.referenceMaterials || [];
  const webLinks = (version.onlineResources || []).map(formatOnlineEntry).filter(Boolean);

  const textbooksHtml = textbooks.length ? `
    <div class="cp-unit">
      <p class="cp-unit-title">Text Books:</p>
      <div class="cp-reflist">
        ${textbooks.map((item, i) => `<span class="cp-ref-num">${i + 1}</span><span>${escHtml(formatBookEntry(item))}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const refbooksHtml = refBooks.length ? `
    <div class="cp-unit">
      <p class="cp-unit-title">Reference Books:</p>
      <div class="cp-reflist">
        ${refBooks.map((item, i) => `<span class="cp-ref-num">${i + 1}</span><span>${escHtml(formatBookEntry(item))}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const webLinksHtml = webLinks.length ? `
    <div class="cp-unit">
      <p class="cp-unit-title">Web Links:</p>
      <div class="cp-reflist">
        ${webLinks.map((link, i) => `<span class="cp-ref-num">${i + 1}</span><span>${escHtml(link)}</span>`).join('')}
      </div>
    </div>
  ` : '';

  return `
    <section class="course-page page-break">
      <div class="cp-title-block">
        <div class="cp-course-name">${courseTitle}</div>
        <div class="cp-common-to">${commonToText}</div>
      </div>
      <div class="cp-meta-row">
        <div class="cp-code-block"><strong>Course Code:</strong> ${courseCode}</div>
        <table class="cp-ltpc">
          <thead><tr><th>L</th><th>T</th><th>P</th><th>S</th><th>C</th></tr></thead>
          <tbody><tr><td>${L}</td><td>${T}</td><td>${P}</td><td>${S}</td><td>${C}</td></tr></tbody>
        </table>
      </div>
      ${outcomes.length > 0 ? `
        <div class="cp-section">
          <p class="cp-section-label">Course Outcomes:</p>
          <p class="cp-section-label">At the end of the Course, Student will be able to:</p>
          <table class="cp-co-table"><tbody>
            ${outcomes.map(co => `
              <tr>
                <td class="cp-co-code">${escHtml(co.coCode)}:</td>
                <td>${escHtml(co.description || 'Outcome statement not defined.')}</td>
              </tr>
            `).join('')}
          </tbody></table>
        </div>
        ${coPoTable}
        ${coPsoTable}
      ` : ''}
      ${unitsHtml}
      ${textbooksHtml}
      ${refbooksHtml}
      ${webLinksHtml}
    </section>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
//  CREDIT DIVISION TABLE — EXACT MATCH OF PDF PAGE 3
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_NAMES = {
  'PC': 'Professional Core Courses (PC)',
  'PE': 'Professional Elective Courses (PE)',
  'OE': 'Open Elective Courses (OE)',
  'BS': 'Basic Science Courses (BS)',
  'ES': 'Engineering Science Courses (ES)',
  'HS': 'Humanities and Social Sciences (HS)',
  'MC': 'Mandatory Courses (MC)',
  'MCC': 'Major Core Courses (MCC)',
  'MDC': 'Multidisciplinary Courses (MDC)',
  'AEC': 'Ability Enhancement Courses (AEC)',
  'SEC': 'Skill Enhancement Courses (SEC)',
  'VAC': 'Value Added Courses (VAC)',
  'MSC': 'Minor Stream Courses (MSC)',
  'UEC': 'University Open Elective Courses (UEC)',
  'SI': 'Summer Internships (SI)',
  'PROJ': 'Full Semester Internship (PROJ)'
};

const CATEGORY_UGC = {
  'MCC': '80',
  'MSC/UEC': '32',
  'MSC': '32',
  'UEC': '32',
  'MDC': '9',
  'AEC': '8',
  'SEC': '9',
  'VAC': '6-8',
  'SI': '2-4',
  'PROJ': '12',
  'MC': ''
};

const renderCategoryTable = (title, rows) => {
  if (!rows.length) return '';
  const totals = rows.reduce((acc, v) => {
    acc.L += v.credits?.L || 0; acc.T += v.credits?.T || 0;
    acc.P += v.credits?.P || 0; acc.S += v.credits?.S || 0; acc.C += v.credits?.C || 0;
    return acc;
  }, { L: 0, T: 0, P: 0, S: 0, C: 0 });

  return `
    <div class="struct-table-block">
      <h3 class="struct-category-title">${escHtml(title)}</h3>
      <table class="struct-table">
        <thead>
          <tr>
            <th>Course Code</th><th>Course Name</th><th>Level</th>
            <th>L</th><th>T</th><th>P</th><th>S</th><th>C</th>
            <th>CIE</th><th>SEE</th><th>Total</th><th>Pre-requisite</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(v => `
            <tr>
              <td>${escHtml(v.courseId?.code || '-')}</td>
              <td class="ta-l">${escHtml(v.courseId?.title || '-')}</td>
              <td>${getCourseLevelCode(v)}</td>
              <td>${v.credits?.L || ''}</td><td>${v.credits?.T || ''}</td>
              <td>${v.credits?.P || ''}</td><td>${v.credits?.S || ''}</td><td>${v.credits?.C || ''}</td>
              <td>${v.cieSee?.cieMaxMarks || 50}</td>
              <td>${v.cieSee?.seeMaxMarks || 50}</td>
              <td>${(v.cieSee?.cieMaxMarks || 50) + (v.cieSee?.seeMaxMarks || 50)}</td>
              <td>${escHtml(v.prerequisites?.[0] || '-')}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3"><strong>Total</strong></td>
            <td><strong>${totals.L || ''}</strong></td>
            <td><strong>${totals.T || ''}</strong></td>
            <td><strong>${totals.P || ''}</strong></td>
            <td><strong>${totals.S || ''}</strong></td>
            <td><strong>${totals.C || ''}</strong></td>
            <td colspan="4"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
//  BUILD DYNAMIC CURRICULUM HTML — EXACT REPLICA OF THE UPLOADED PDF
// ─────────────────────────────────────────────────────────────────────────────
const buildDynamicCurriculumHtml = (book, dynamicContext) => {
  const courses = dynamicContext?.courses || [];
  if (!courses.length) return '';

  const departmentName = book.departmentId?.name || 'Computer Science and Engineering';
  const semesterCount = dynamicContext?.regulation?.semesterCount || 8;
  const programTotalCredits = dynamicContext?.regulation?.programId?.totalCredits || 160;

  const categoryTotals = courses.reduce((acc, v) => {
    const cat = v.category || 'MCC';
    acc[cat] = (acc[cat] || 0) + (v.credits?.C || 0);
    return acc;
  }, {});
  const grandTotal = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

  const dbCategories = dynamicContext?.dbCategories || [];
  const dynamicCategoryRows = dbCategories.map(cat => ({
    code: cat.code,
    name: cat.name,
    ugc: cat.ugc || '-'
  }));

  const getRowCredits = (code) => {
    if (code === 'MSC/UEC') return (categoryTotals['MSC'] || 0) + (categoryTotals['UEC'] || 0);
    return categoryTotals[code] || 0;
  };

  // FC / IC / AC counts
  const fcCourses = courses.filter(v => getCourseLevelCode(v) === 'FC');
  const icCourses = courses.filter(v => getCourseLevelCode(v) === 'IC');
  const acCourses = courses.filter(v => getCourseLevelCode(v) === 'AC');
  const fcCredits = fcCourses.reduce((s, v) => s + (v.credits?.C || 0), 0);
  const icCredits = icCourses.reduce((s, v) => s + (v.credits?.C || 0), 0);
  const acCredits = acCourses.reduce((s, v) => s + (v.credits?.C || 0), 0);

  // ── Page: Credit Division Category-wise ──
  const creditDivisionPage = `
    <section class="dyn-page page-break">
      <h2 class="dyn-h2">Credit Division Category-wise</h2>
      <div class="level-note">
        <p><strong>Foundation Courses – FC</strong></p>
        <p><strong>Intermediate-level Courses – IC</strong></p>
        <p><strong>Advanced Courses – AC</strong></p>
      </div>
      <table class="credit-div-table">
        <thead>
          <tr><th>S.No</th><th>Broad Category of Course</th><th>UGC</th><th>Credits</th></tr>
        </thead>
        <tbody>
          ${dynamicCategoryRows.map((row, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="ta-l">${escHtml(row.name).replace(/\\n/g, '<br>')}</td>
              <td>${escHtml(row.ugc)}</td>
              <td>${getRowCredits(row.code)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2"><strong>Total Credits to be earned for B. Tech Degree</strong></td>
            <td><strong>${programTotalCredits}</strong></td>
            <td><strong>${grandTotal || programTotalCredits}</strong></td>
          </tr>
        </tbody>
      </table>
    </section>
  `;

  // ── Page: Category-wise Course Tables (Dynamic) ──
  const categoryTablesPage = `
    <section class="dyn-page page-break">
      ${dynamicCategoryRows.map(row => renderCategoryTable(row.name, courses.filter(v => (v.category || 'MCC') === row.code))).join('')}
    </section>
  `;

  // ── Pages: Semester-wise Curriculum (exact PDF format) ──
  // Format: Course code | Course Title | Category | Level | L T P Total | Total Hours
  const semesterPages = `
    <section class="dyn-page page-break">
      <h2 class="dyn-h2">Suggestive Semester-wise Curriculum</h2>
      ${Array.from({ length: semesterCount }, (_, i) => {
        const semNum = i + 1;
        const semCourses = courses.filter(v => v.semester === semNum);
        if (!semCourses.length) return '';
        const totals = semCourses.reduce((acc, v) => {
          acc.L += v.credits?.L || 0; acc.T += v.credits?.T || 0;
          acc.P += v.credits?.P || 0; acc.S += v.credits?.S || 0; acc.C += v.credits?.C || 0;
          return acc;
        }, { L: 0, T: 0, P: 0, S: 0, C: 0 });
        return `
          <div class="sem-block">
            <h3 class="sem-title">${ROMAN[i] || semNum} SEMESTER</h3>
            <table class="sem-table">
              <thead>
                <tr>
                  <th>Course code</th>
                  <th>Course Title</th>
                  <th colspan="2">Course Credits</th>
                  <th>Total Hours</th>
                </tr>
                <tr class="sem-subhdr">
                  <th></th><th></th>
                  <th>Category</th><th>Level</th>
                  <th>L</th><th>T</th><th>P</th><th>S</th><th>Total</th><th></th>
                </tr>
              </thead>
              <tbody>
                ${semCourses.map(v => {
                  const l = v.credits?.L || 0;
                  const t = v.credits?.T || 0;
                  const p = v.credits?.P || 0;
                  const s = v.credits?.S || 0;
                  const c = v.credits?.C || 0;
                  const hours = l + t + (p > 0 ? Math.max(p, 1) : 0) + (s > 0 ? Math.max(s, 1) : 0);
                  return `
                    <tr>
                      <td>${escHtml(v.courseId?.code || '-')}</td>
                      <td class="ta-l">${escHtml(v.courseId?.title || '-')}</td>
                      <td>${escHtml(v.category || '-')}</td>
                      <td>${getCourseLevelCode(v)}</td>
                      <td>${l || ''}</td><td>${t || ''}</td><td>${p || ''}</td><td>${s || ''}</td><td>${c}</td>
                      <td>${hours || c}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="total-row">
                  <td colspan="4"><strong>Total</strong></td>
                  <td><strong>${totals.L || ''}</strong></td>
                  <td><strong>${totals.T || ''}</strong></td>
                  <td><strong>${totals.P || ''}</strong></td>
                  <td><strong>${totals.S || ''}</strong></td>
                  <td><strong>${totals.C}</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }).join('')}
      <p class="credit-summary">Total Credits: ${grandTotal || programTotalCredits}</p>
    </section>
  `;

  // ── Pages: Minor Stream Tables ──
  const minorStreamPages = (dynamicContext?.minorStreams || []).length ? `
    <section class="dyn-page page-break">
      ${(dynamicContext.minorStreams || []).map(stream => {
        const streamCourses = stream.courses || [];
        return `
          <div class="struct-table-block">
            <h3 class="struct-category-title">Minor Stream: ${escHtml(stream.name)}</h3>
            ${streamCourses.length === 0 ? '<p style="font-size:9pt;color:#9ca3af;font-style:italic;">No courses assigned to this minor stream yet.</p>' : `
            <table class="struct-table">
              <thead>
                <tr>
                  <th>Course Code</th><th>Course Name</th><th>Level</th>
                  <th>L</th><th>T</th><th>P</th><th>S</th><th>C</th>
                  <th>CIE</th><th>SEE</th><th>Total</th><th>Pre-requisite</th>
                </tr>
              </thead>
              <tbody>
                ${streamCourses.map(c => `
                  <tr>
                    <td>${escHtml(c.code || '-')}</td>
                    <td class="ta-l">${escHtml(c.title || '-')}</td>
                    <td>-</td>
                    <td></td><td></td><td></td><td></td><td></td>
                    <td>50</td><td>50</td><td>100</td>
                    <td>-</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`}
          </div>
        `;
      }).join('')}
    </section>
  ` : '';

  // ── Pages: Individual Course Pages ──
  const coursePages = courses.map(v => renderCoursePageHtml(v, departmentName)).join('');

  return creditDivisionPage + categoryTablesPage + semesterPages + minorStreamPages + coursePages;
};

// ─────────────────────────────────────────────────────────────────────────────
//  PDF-READY HTML BUILDER — COMPLETE DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const buildPdfReadyHtml = (book, sections, dynamicContext = {}) => {
  const departmentName = book.departmentId?.name || 'Computer Science and Engineering';
  const regulation = book.regulation || 'R24';
  const academicYear = book.academicYear || '2024-25';
  const dynamicHtml = buildDynamicCurriculumHtml(book, dynamicContext);
  const logoSrc = getLogoBase64();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(book.title)} - Curriculum Book</title>
<style>
  /* ── RESET & BASE ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
  html, body { width: 210mm; background: #e5e7eb; }
  body { font-family: "Times New Roman", Times, serif; color: #0a0a0a; font-size: 10.5pt; line-height: 1.35; }
  .book { width: 210mm; margin: 0 auto; background: #fff; }

  /* ── COVER PAGE ── */
  .cover {
    width: 210mm; height: 297mm;
    display: flex; flex-direction: column; justify-content: space-between;
    text-align: center;
    padding: 28mm 22mm 24mm;
    border: 2px solid #111827;
    outline: 4px double #111827;
    outline-offset: -9mm;
    page-break-after: always;
    position: relative;
  }
  .cover-logo { width: 55mm; height: auto; margin: 0 auto 10mm; display: block; }
  .cover-main-title {
    font-size: 24pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; color: #111827; line-height: 1.2;
    margin-bottom: 6mm;
  }
  .cover-for { font-size: 11pt; font-weight: 600; margin-bottom: 3mm; }
  .cover-program {
    font-size: 16pt; font-weight: 800; text-transform: uppercase;
    color: #991b1b; margin-bottom: 3mm;
  }
  .cover-applicable { font-size: 10.5pt; font-weight: 600; margin-bottom: 0; }
  .cover-dept {
    font-size: 16pt; font-weight: 800; text-transform: uppercase;
    color: #991b1b; margin-bottom: 3mm;
  }
  .cover-reg { font-size: 11pt; font-weight: 600; margin-bottom: 0; }
  .cover-address { font-size: 11pt; font-weight: 600; }
  .cover-university { font-size: 11pt; font-weight: 600; margin-top: 2mm; }

  /* ── HEADER / FOOTER ── */
  .page-content { padding: 4mm 18mm 0; min-height: 240mm; }

  /* ── SECTION HEADINGS ── */
  .cs-h2 {
    text-align: center; font-size: 15pt; font-weight: 700;
    text-transform: uppercase; border-bottom: 1.5px solid #111827;
    padding-bottom: 2.5mm; margin-bottom: 9mm;
    page-break-before: always; color: #111827;
  }
  .cs-h3 { font-size: 13pt; color: #991b1b; text-align: center; font-weight: 700; text-transform: uppercase; margin: 8mm 0 3mm; }
  .rich { font-size: 10.5pt; line-height: 1.42; }
  .rich p { margin-bottom: 3.5mm; text-align: justify; }
  .rich table { width: 100%; border-collapse: collapse; margin: 4mm 0; }
  .rich th, .rich td { border: 1px solid #111827; padding: 1.8mm 2.5mm; vertical-align: top; }
  .rich th { background: #f3f4f6; font-weight: 700; text-align: center; }
  .rich img { max-width: 100%; }

  /* ── STANDARD TABLE ── */
  .std-table { width: 100%; border-collapse: collapse; }
  .std-table th, .std-table td { border: 1px solid #111827; padding: 2mm 2.5mm; font-size: 10pt; vertical-align: top; }
  .std-table th { background: #f3f4f6; font-weight: 700; text-align: center; }

  /* ── DYNAMIC PAGES ── */
  .dyn-page { padding: 2mm 0; }
  .dyn-h2 {
    text-align: center; font-size: 13pt; font-weight: 700;
    margin-bottom: 8mm; page-break-before: always;
    border-bottom: 1.5px solid #111827; padding-bottom: 2.5mm;
    text-transform: uppercase;
  }

  /* ── LEVEL NOTE ── */
  .level-note { width: 75%; margin: 0 auto 6mm; font-size: 10pt; line-height: 1.5; }
  .level-note p { margin-bottom: 1mm; }

  /* ── CREDIT DIVISION TABLE (Page 3 exact match) ── */
  .credit-div-table {
    width: 100%; border-collapse: collapse; margin-top: 4mm;
    font-size: 10pt; line-height: 1.25;
  }
  .credit-div-table th, .credit-div-table td {
    border: 1px solid #111827; padding: 3mm 2.5mm;
    text-align: center; vertical-align: middle;
  }
  .credit-div-table th { background: #e5e7eb; font-weight: 700; }
  .credit-div-table .ta-l { text-align: left; }
  .credit-div-table .total-row td { font-weight: 700; background: #f9fafb; }

  /* ── CATEGORY / SEMESTER STRUCTURE TABLES ── */
  .struct-table-block { margin-bottom: 10mm; break-inside: avoid; }
  .struct-category-title {
    font-size: 10.5pt; font-weight: 700; margin-bottom: 2.5mm;
    text-transform: uppercase;
  }
  .struct-table {
    width: 100%; border-collapse: collapse; font-size: 8.5pt; line-height: 1.1;
  }
  .struct-table th, .struct-table td {
    border: 1px solid #000; padding: 1.2mm 1.5mm;
    text-align: center; vertical-align: middle;
  }
  .struct-table th { font-weight: 700; background: #e5e7eb; }
  .struct-table .ta-l { text-align: left; }
  .struct-table .total-row td { font-weight: 700; background: #f9fafb; }

  /* ── SEMESTER TABLES ── */
  .sem-block { margin-bottom: 10mm; break-inside: avoid; }
  .sem-title {
    font-size: 11pt; font-weight: 700; text-transform: uppercase;
    margin-bottom: 2.5mm; text-align: center;
  }
  .sem-table {
    width: 100%; border-collapse: collapse; font-size: 8.5pt; line-height: 1.1;
  }
  .sem-table th, .sem-table td {
    border: 1px solid #000; padding: 1.2mm 1.5mm;
    text-align: center; vertical-align: middle;
  }
  .sem-table th { font-weight: 700; background: #e5e7eb; }
  .sem-table .ta-l { text-align: left; }
  .sem-table .total-row td { font-weight: 700; background: #f9fafb; }
  .sem-table .sem-subhdr th { font-size: 7.5pt; background: #f3f4f6; }
  .credit-summary { font-size: 10.5pt; font-weight: 700; margin-top: 5mm; text-align: right; }

  /* ── COURSE PAGES (exact match to PDF) ── */
  .course-page {
    padding: 5mm 0;
    font-size: 10.5pt;
    line-height: 1.35;
  }
  .cp-title-block { text-align: center; margin: 2mm 10mm 7mm; }
  .cp-course-name { font-size: 10.5pt; font-weight: 700; line-height: 1.2; }
  .cp-common-to { font-size: 9.5pt; font-weight: 600; margin-top: 1mm; }
  .cp-meta-row {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 5mm; gap: 10mm; font-size: 10pt;
  }
  .cp-code-block { font-size: 10pt; font-weight: 600; line-height: 1.4; }
  .cp-ltpc { border-collapse: collapse; font-size: 10pt; min-width: 30mm; }
  .cp-ltpc th, .cp-ltpc td { 
    padding: 0.5mm 3mm 0.5mm 0; text-align: center;
    font-weight: 700; border: none;
  }
  .cp-section { margin-bottom: 4mm; }
  .cp-section-label { font-weight: 700; font-size: 10pt; margin-bottom: 1.5mm; }
  .cp-co-table { width: 100%; border-collapse: collapse; font-size: 9.8pt; line-height: 1.15; }
  .cp-co-table td { border: none; padding: 0.3mm 0; vertical-align: top; }
  .cp-co-code { width: 12mm; font-weight: 700; white-space: nowrap; padding-right: 1.5mm; }
  .cp-matrix {
    width: auto; min-width: 55%; max-width: 100%;
    margin: 2mm auto 0; border-collapse: collapse; table-layout: fixed;
    font-size: 8.5pt; line-height: 1;
  }
  .cp-matrix th, .cp-matrix td {
    border: 1px solid #000; padding: 1mm 1.8mm;
    text-align: center; vertical-align: middle;
    min-width: 7.5mm; height: 4mm;
  }
  .cp-matrix th, .cp-matrix td:first-child { font-weight: 700; }
  .cp-unit { margin-top: 6mm; }
  .cp-unit-title { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; margin-bottom: 3mm; }
  .cp-unit-body { text-align: justify; font-size: 9.8pt; line-height: 1.15; }
  .cp-unit-body p { margin-bottom: 1.5mm; }
  .cp-unit-body h1, .cp-unit-body h2, .cp-unit-body h3, .cp-unit-body h4 { font-size: 10pt; font-weight: 700; margin-bottom: 1mm; }
  .cp-unit-body table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 9pt; }
  .cp-unit-body th, .cp-unit-body td { border: 1px solid #000; padding: 1mm; vertical-align: top; }
  .cp-reflist { display: grid; grid-template-columns: 8mm 1fr; column-gap: 2mm; row-gap: 1.5mm; font-size: 9.8pt; line-height: 1.2; }
  .cp-ref-num { text-align: center; font-weight: 700; }

  /* ── PAGE BREAKS ── */
  .page-break { break-before: page; page-break-before: always; }
  .cs-section { break-before: page; page-break-before: always; }

  /* ── UTILITIES ── */
  .ta-l { text-align: left !important; }
  .total-row td { background: #f9fafb; }

  /* ── BROWSER PRINT HEADERS ── */
  .browser-print-header, .browser-print-footer { display: none; }
  @media print {
    html, body { background: #fff; }
    .book { width: 100%; margin: 0; box-shadow: none; }
    
    body:not(.is-puppeteer) .browser-print-header {
      display: flex; position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      justify-content: space-between; align-items: flex-start; padding: 5mm 18mm 0; background: white;
    }
    body:not(.is-puppeteer) .browser-print-footer {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000;
      justify-content: space-between; padding: 2.5mm 18mm 2mm; background: white; border-top: 1px solid #374151;
      font-size: 9pt; color: #374151; font-weight: 500;
    }
    body:not(.is-puppeteer) .page-content {
      padding-top: 5mm;
    }
  }
</style>
</head>
<body>
<div class="browser-print-header">
  <div style="font-size: 8.5pt; font-weight: 600; color: #374151; line-height: 1.3; max-width: 130mm;">
    <strong>Department of ${escHtml(departmentName)}</strong><br>
    B.Tech Program Curriculum-${escHtml(regulation.replace('R', '20'))} (Applicable for batches admitted from A.Y. ${escHtml(academicYear)})
  </div>
  ${logoSrc ? `<img src="${logoSrc}" style="height: 14mm; width: auto; display: block;" />` : ''}
</div>
<div class="browser-print-footer">
  <span>B.Tech (${escHtml(departmentName)}) Curriculum-${escHtml(academicYear)}</span>
  <span>Aditya University</span>
</div>
<main class="book">

  <!-- ── COVER PAGE ── -->
  <div class="cover">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" alt="Aditya University" class="cover-logo" />` : ''}
      <div class="cover-main-title">Program Curriculum</div>
      <div class="cover-for">for</div>
      <div class="cover-program">B. Tech. Four Year Degree Program</div>
      <div class="cover-applicable">(Applicable for the batches admitted from A.Y. ${escHtml(academicYear)})</div>
    </div>
    <div>
      <div class="cover-dept">${escHtml(departmentName)}</div>
      <div class="cover-reg">${escHtml(regulation)} Curriculum</div>
    </div>
    <div>
      <div class="cover-address">Aditya Nagar, ADB Road, Surampalem - 533 437</div>
      <div class="cover-university">Aditya University</div>
    </div>
  </div>

  <div class="page-content">
    ${sections.map(sectionToHtml).join('\n')}
    ${dynamicHtml}
  </div>

</main>
</body>
</html>`;
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
export const uploadCurriculum = async (req, res, next) => {
  try {
    const { departmentId, title, regulation, academicYear } = req.body;

    if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ message: 'Invalid department ID' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileType = getFileType(req.file);
    if (!fileType) {
      return res.status(400).json({ message: 'Only PDF and DOCX curriculum books are allowed.' });
    }

    const filePath = `/uploads/curriculum-books/${req.file.filename}`;
    const extractedHtml = await extractUploadHtml(req.file, fileType);

    const newBook = await CurriculumBook.create({
      departmentId, title, regulation, academicYear, filePath,
      uploadedFile: filePath, originalFileName: req.file.originalname,
      fileType, mimeType: req.file.mimetype, fileSize: req.file.size,
      uploadDate: new Date(), createdBy: req.user.id, updatedBy: req.user.id,
    });

    await CurriculumSection.insertMany(buildInitialSections(newBook._id, extractedHtml));

    await CurriculumVersion.create({
      curriculumBookId: newBook._id, versionNumber: 1,
      content: await snapshotFor(newBook), editedContent: await snapshotFor(newBook),
      editedBy: req.user.id, modifiedBy: req.user.id,
      changeSummary: 'Initial upload', status: newBook.status,
    });

    return res.status(201).json({ message: 'Curriculum book uploaded successfully', curriculumBook: newBook });
  } catch (error) {
    return next(error);
  }
};

export const listCurriculums = async (req, res, next) => {
  try {
    const { departmentId, status } = req.query;
    const query = {};
    if (departmentId) query.departmentId = departmentId;
    if (status) query.status = status;

    const books = await CurriculumBook.find(query)
      .populate('departmentId', 'name code')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ curriculumBooks: books });
  } catch (error) {
    return next(error);
  }
};

export const getCurriculum = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const book = await CurriculumBook.findById(req.params.id)
      .populate('departmentId', 'name code')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    const sections = await CurriculumSection.find({ curriculumBookId: book._id }).sort({ orderNumber: 1 });
    return res.status(200).json({ curriculumBook: book, sections });
  } catch (error) {
    return next(error);
  }
};

export const updateCurriculum = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const { sections, ...body } = req.body;
    const book = await CurriculumBook.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    ['title', 'regulation', 'academicYear', 'status'].forEach(field => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        if (field === 'status' && !STATUS_VALUES.includes(body[field])) return;
        book[field] = body[field];
      }
    });
    book.updatedBy = req.user.id;
    await book.save();

    if (Array.isArray(sections)) {
      const retainedSectionIds = [];
      for (const [index, rawSection] of sections.entries()) {
        const section = normalizeSection(rawSection, index);
        if (rawSection._id) {
          const updated = await CurriculumSection.findOneAndUpdate(
            { _id: rawSection._id, curriculumBookId: book._id },
            section, { new: true, runValidators: true }
          );
          if (updated?._id) retainedSectionIds.push(updated._id);
        } else {
          const created = await CurriculumSection.create({ ...section, curriculumBookId: book._id });
          retainedSectionIds.push(created._id);
        }
      }
      await CurriculumSection.deleteMany({ curriculumBookId: book._id, _id: { $nin: retainedSectionIds } });
    }

    const updatedSections = await CurriculumSection.find({ curriculumBookId: book._id }).sort({ orderNumber: 1 });
    return res.status(200).json({ message: 'Curriculum book saved successfully', curriculumBook: book, sections: updatedSections });
  } catch (error) {
    return next(error);
  }
};

export const deleteCurriculum = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const book = await CurriculumBook.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    await CurriculumSection.deleteMany({ curriculumBookId: req.params.id });
    await CurriculumVersion.deleteMany({ curriculumBookId: req.params.id });
    return res.status(200).json({ message: 'Curriculum book deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

export const createVersion = async (req, res, next) => {
  try {
    const { curriculumBookId, changeSummary = 'Saved curriculum version' } = req.body;
    if (!mongoose.Types.ObjectId.isValid(curriculumBookId)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const book = await CurriculumBook.findById(curriculumBookId);
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    const newVersionNumber = book.currentVersion + 1;
    book.currentVersion = newVersionNumber;
    book.updatedBy = req.user.id;
    await book.save();

    const content = await snapshotFor(book);
    const version = await CurriculumVersion.create({
      curriculumBookId, versionNumber: newVersionNumber,
      content, editedContent: content, editedBy: req.user.id, modifiedBy: req.user.id,
      changeSummary, status: book.status,
    });

    return res.status(201).json({ message: 'Curriculum version created', version, curriculumBook: book });
  } catch (error) {
    return next(error);
  }
};

export const getVersionHistory = async (req, res, next) => {
  try {
    const { curriculumBookId } = req.query;
    if (!curriculumBookId || !mongoose.Types.ObjectId.isValid(curriculumBookId)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const versions = await CurriculumVersion.find({ curriculumBookId })
      .populate('editedBy', 'name email')
      .populate('modifiedBy', 'name email')
      .sort({ versionNumber: -1 });
    return res.status(200).json({ versions });
  } catch (error) {
    return next(error);
  }
};

export const restoreVersion = async (req, res, next) => {
  try {
    const { id, versionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(versionId)) {
      return res.status(400).json({ message: 'Invalid ID parameters' });
    }
    const version = await CurriculumVersion.findOne({ _id: versionId, curriculumBookId: id });
    const book = await CurriculumBook.findById(id);
    if (!book || !version) return res.status(404).json({ message: 'Curriculum book or version not found' });

    const snapshot = version.content || version.editedContent || {};
    const snapshotSections = Array.isArray(snapshot.sections) ? snapshot.sections : [];

    await CurriculumSection.deleteMany({ curriculumBookId: id });
    if (snapshotSections.length > 0) {
      await CurriculumSection.insertMany(snapshotSections.map((section, index) => ({
        ...normalizeSection(section, index), curriculumBookId: id,
      })));
    }

    const restoredVersionNumber = book.currentVersion + 1;
    book.currentVersion = restoredVersionNumber;
    book.status = 'Draft';
    book.updatedBy = req.user.id;
    await book.save();

    const restoredSnapshot = await snapshotFor(book);
    const restoredVersion = await CurriculumVersion.create({
      curriculumBookId: id, versionNumber: restoredVersionNumber,
      content: restoredSnapshot, editedContent: restoredSnapshot,
      editedBy: req.user.id, modifiedBy: req.user.id,
      changeSummary: `Restored from version ${version.versionNumber}`,
      status: book.status,
    });

    const sections = await CurriculumSection.find({ curriculumBookId: id }).sort({ orderNumber: 1 });
    return res.status(200).json({
      message: `Version ${version.versionNumber} restored as version ${restoredVersionNumber}`,
      curriculumBook: book, sections, version: restoredVersion,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const { status } = req.body;
    if (!STATUS_VALUES.includes(status)) {
      return res.status(400).json({ message: 'Invalid curriculum book status.' });
    }

    const book = await CurriculumBook.findByIdAndUpdate(
      req.params.id, { status, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    const content = await snapshotFor(book);
    const version = await CurriculumVersion.create({
      curriculumBookId: book._id, versionNumber: book.currentVersion + 1,
      content, editedContent: content, editedBy: req.user.id, modifiedBy: req.user.id,
      changeSummary: `Status changed to ${status}`, status,
    });
    book.currentVersion = version.versionNumber;
    await book.save();

    return res.status(200).json({ message: `Curriculum book ${status.toLowerCase()}`, curriculumBook: book, version });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT PDF — USING PUPPETEER (streams binary PDF directly)
// ─────────────────────────────────────────────────────────────────────────────
export const exportPdf = async (req, res, next) => {
  let browser = null;
  try {
    // Support two modes:
    // Mode A: regulationId + departmentId  → generates curriculum handbook PDF on the fly
    // Mode B: curriculumBookId             → generates PDF from an uploaded curriculum book record
    const { curriculumBookId, regulationId, departmentId, htmlContent, styles, baseUrl } = req.body;

    let html = '';
    let pdfFilename = 'curriculum_book.pdf';

    if (htmlContent) {
      const reg = regulationId ? await Regulation.findById(regulationId).lean() : null;
      const dept = departmentId ? await Department.findById(departmentId).lean() : null;
      pdfFilename = `${reg?.code || 'Export'}_${dept?.code || 'Curriculum'}.pdf`;
      html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Curriculum PDF</title>
  ${baseUrl ? `<base href="${baseUrl}/">` : ''}
  ${styles || ''}
  <style>
    body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; }
    ::-webkit-scrollbar { display: none; }
  </style>
</head>
<body class="bg-white">
  ${htmlContent}
</body>
</html>`;
    } else if (regulationId) {
      // Mode A: Handbook generator (from CurriculumBookGenerator page)
      if (!mongoose.Types.ObjectId.isValid(regulationId)) {
        return res.status(400).json({ message: 'Invalid regulation ID' });
      }

      const regulation  = await Regulation.findById(regulationId).lean();
      if (!regulation) return res.status(404).json({ message: 'Regulation not found' });

      let dept = null;
      if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
        dept = await Department.findById(departmentId).lean();
      }

      // Build a lightweight book proxy so we can reuse buildPdfReadyHtml
      const bookProxy = {
        _id: regulationId,
        title: `${regulation.code} Curriculum Book`,
        regulation: regulation.code,
        academicYear: regulation.academicYear || '2024-25',
        currentVersion: 1,
        departmentId: dept || { name: 'Computer Science and Engineering', code: 'CSE' },
      };

      const dynamicContext = await getDynamicCurriculumContext(bookProxy);
      html = buildPdfReadyHtml(bookProxy, [], dynamicContext);

      const deptCode = dept?.code || 'CSE';
      const progCode = regulation.code || 'R24';
      pdfFilename = `${progCode}_${deptCode}_CurriculumBook.pdf`;

    } else if (curriculumBookId) {
      // Mode B: Existing curriculum book record
      if (!mongoose.Types.ObjectId.isValid(curriculumBookId)) {
        return res.status(400).json({ message: 'Invalid curriculum book ID' });
      }
      const book = await CurriculumBook.findById(curriculumBookId).populate('departmentId', 'name code');
      if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

      const sections = await CurriculumSection.find({ curriculumBookId }).sort({ orderNumber: 1 }).lean();
      const dynamicContext = await getDynamicCurriculumContext(book);
      html = buildPdfReadyHtml(book, sections, dynamicContext);
      pdfFilename = `${book.title.replace(/[^\w.-]+/g, '_')}_v${book.currentVersion}.pdf`;
    } else {
      return res.status(400).json({ message: 'Provide either regulationId or curriculumBookId.' });
    }

    // ── Launch Puppeteer and generate PDF ──
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.body.classList.add('is-puppeteer'));

    const logoBase64 = getLogoBase64();
    
    const pdfOptions = htmlContent ? {
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '10mm', right: '15mm', bottom: '15mm', left: '15mm' },
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="font-family:'Times New Roman',serif; font-size:10pt; width:100%; text-align:center; color:#374151;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `
    } : {
      format: 'A4',
      printBackground: true,
      margin: { top: '28mm', right: '18mm', bottom: '24mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-family:'Times New Roman',serif; font-size:8pt; width:100%;
             display:flex; justify-content:space-between; align-items:flex-start;
             padding:4mm 18mm 0; box-sizing:border-box; background:white;">
          <div style="font-weight:700; color:#111; line-height:1.3; max-width:75%;">
            <span style="display:block;">Aditya University — Outcome Based Curriculum Portal</span>
          </div>
          ${logoBase64 ? `<img src="${logoBase64}" style="height:10mm;width:auto;" />` : ''}
        </div>
      `,
      footerTemplate: `
        <div style="font-family:'Times New Roman',serif; font-size:8pt; width:100%;
             padding:0 18mm 3mm; box-sizing:border-box; display:flex;
             justify-content:space-between; color:#374151;
             border-top:0.5pt solid #374151;">
          <span>Academic Curriculum &amp; Syllabus Book</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <span>Aditya University</span>
        </div>
      `,
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    await browser.close();
    browser = null;

    // ── Stream the PDF directly to the client ──
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);

  } catch (error) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT DOCX — streams a rich .docx via curriculumDocxService
// ─────────────────────────────────────────────────────────────────────────────
export const exportDocx = async (req, res, next) => {
  try {
    const { regulationId, departmentId } = req.query;

    if (!regulationId || !mongoose.Types.ObjectId.isValid(regulationId)) {
      return res.status(400).json({ message: 'Invalid or missing regulationId query param.' });
    }

    let dept = null;
    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
      dept = await Department.findById(departmentId).lean();
    }

    const regulation = await Regulation.findById(regulationId).lean();
    if (!regulation) return res.status(404).json({ message: 'Regulation not found.' });

    // Resolve program info
    let programName = 'B. Tech. Four Year Degree Program';
    let programCode = 'B.Tech';
    let totalCredits = 160;
    if (regulation.programId) {
      try {
        const prog = await Program.findById(regulation.programId).lean();
        if (prog) {
          programName   = prog.degree || prog.name || programName;
          programCode   = prog.code   || programCode;
          totalCredits  = prog.totalCredits || totalCredits;
        }
      } catch (_) {}
    }

    const buffer = await generateCurriculumDocx({
      regulationId,
      departmentId: departmentId || null,
      departmentName:      dept?.name || 'Computer Science and Engineering',
      departmentCode:      dept?.code || 'CSE',
      programName,
      programCode,
      programTotalCredits: totalCredits,
    });

    const deptCode = dept?.code || 'CSE';
    const filename = `${regulation.code}_${deptCode}_CurriculumBook.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);

  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  LIVE PREVIEW — Returns HTML without creating a PDF file
// ─────────────────────────────────────────────────────────────────────────────
export const livePreview = async (req, res, next) => {
  try {
    const { curriculumBookId } = req.query;
    if (!curriculumBookId || !mongoose.Types.ObjectId.isValid(curriculumBookId)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }

    const book = await CurriculumBook.findById(curriculumBookId).populate('departmentId', 'name code');
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    const sections = await CurriculumSection.find({ curriculumBookId }).sort({ orderNumber: 1 }).lean();
    const dynamicContext = await getDynamicCurriculumContext(book);
    const html = buildPdfReadyHtml(book, sections, dynamicContext);

    return res.status(200).json({ html, message: 'Live preview generated' });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CREDIT SUMMARY — For live dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const creditSummary = async (req, res, next) => {
  try {
    const { regulationId, departmentId } = req.query;
    if (!regulationId || !mongoose.Types.ObjectId.isValid(regulationId)) {
      return res.status(400).json({ message: 'Invalid regulation ID' });
    }

    const versions = await CourseVersion.find({ regulationId })
      .populate({ path: 'courseId', populate: { path: 'departmentId' } })
      .lean();

    const filtered = departmentId
      ? versions.filter(v => {
          const dId = String(v.courseId?.departmentId?._id || v.courseId?.departmentId || '');
          return dId === departmentId || v.category === 'UEC';
        })
      : versions;

    const categoryTotals = {};
    const semesterBreakdown = {};
    let fcCount = 0, icCount = 0, acCount = 0;
    let fcCredits = 0, icCredits = 0, acCredits = 0;

    for (const v of filtered) {
      const cat = v.category || 'MCC';
      const c = v.credits?.C || 0;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + c;

      const sem = v.semester || 1;
      if (!semesterBreakdown[sem]) semesterBreakdown[sem] = { courses: [], credits: 0 };
      semesterBreakdown[sem].courses.push({ code: v.courseId?.code, title: v.courseId?.title, category: cat, credits: v.credits });
      semesterBreakdown[sem].credits += c;

      const level = getCourseLevelCode(v);
      if (level === 'FC') { fcCount++; fcCredits += c; }
      else if (level === 'IC') { icCount++; icCredits += c; }
      else { acCount++; acCredits += c; }
    }

    const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

    return res.status(200).json({
      categoryTotals, grandTotal,
      fcCount, fcCredits, icCount, icCredits, acCount, acCredits,
      semesterBreakdown, totalCourses: filtered.length,
    });
  } catch (error) {
    return next(error);
  }
};
