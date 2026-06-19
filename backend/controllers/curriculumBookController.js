import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mongoose from 'mongoose';
import CurriculumBook from '../models/CurriculumBook.js';
import CurriculumVersion from '../models/CurriculumVersion.js';
import CurriculumSection from '../models/CurriculumSection.js';

const STATUS_VALUES = ['Draft', 'Published', 'Archived'];
const GENERATED_DIR = path.resolve('uploads', 'generated');

const stripUnsafeHtml = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");
};

const escapeHtml = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const textToHtml = (text = '') => escapeHtml(text)
  .split(/\n{2,}/)
  .map(block => block.trim())
  .filter(Boolean)
  .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
  .join('\n');

const getFileType = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || ext === '.pdf') return 'PDF';
  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || ext === '.docx'
  ) return 'DOCX';
  return null;
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
        ? stripUnsafeHtml(value)
        : value;
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
    sections.push({
      curriculumBookId,
      sectionType: 'DocumentBody',
      sectionTitle: 'Editable Curriculum Book',
      sectionContent: { html: '' },
      orderNumber: 1,
    });
  } else {
    // textToHtml outputs paragraphs separated by newlines
    const paragraphs = extractedHtml.split('\n');
    let currentHtml = '';
    let partNum = 1;
    const MAX_CHUNK_LENGTH = 15000; // Limit each TipTap editor to ~15k characters

    for (const p of paragraphs) {
      if (currentHtml.length + p.length > MAX_CHUNK_LENGTH && currentHtml.length > 0) {
        sections.push({
          curriculumBookId,
          sectionType: 'DocumentBody',
          sectionTitle: `Book Content (Part ${partNum})`,
          sectionContent: { html: currentHtml },
          orderNumber: partNum,
        });
        currentHtml = '';
        partNum++;
      }
      currentHtml += (currentHtml ? '\n' : '') + p;
    }
    
    if (currentHtml) {
      sections.push({
        curriculumBookId,
        sectionType: 'DocumentBody',
        sectionTitle: partNum === 1 ? 'Editable Curriculum Book' : `Book Content (Part ${partNum})`,
        sectionContent: { html: currentHtml },
        orderNumber: partNum,
      });
    }
  }

  // Add Vision & Mission section at the end
  sections.push({
    curriculumBookId,
    sectionType: 'ProgramInfo',
    sectionTitle: 'Department Vision and Mission',
    sectionContent: {
      vision: '',
      mission: '',
    },
    orderNumber: sections.length + 1,
  });

  return sections;
};

const snapshotFor = async (book) => {
  const sections = await CurriculumSection.find({ curriculumBookId: book._id }).sort({ orderNumber: 1 }).lean();
  return {
    book: book.toObject ? book.toObject() : book,
    sections: sections.map(section => ({
      sectionType: section.sectionType,
      sectionTitle: section.sectionTitle,
      sectionContent: section.sectionContent,
      orderNumber: section.orderNumber,
    })),
  };
};

const sectionToHtml = (section) => {
  const content = section.sectionContent || {};
  const title = escapeHtml(section.sectionTitle || 'Untitled Section');

  if (typeof content === 'string') {
    return `<div><h2>${title}</h2><div class="rich">${stripUnsafeHtml(content)}</div></div>`;
  }

  if (content.html || content.richTextContent || content.body) {
    return `<div><h2>${title}</h2><div class="rich">${stripUnsafeHtml(content.html || content.richTextContent || content.body)}</div></div>`;
  }

  if (content.vision || content.mission) {
    return `
      <div>
        <h2>${title}</h2>
        <h3>Vision of the Department</h3>
        <div class="rich">${textToHtml(content.vision || '')}</div>
        <h3>Mission of the Department</h3>
        <div class="rich">${textToHtml(content.mission || '')}</div>
      </div>
    `;
  }

  return `
    <div>
      <h2>${title}</h2>
      <table>
        <tbody>
          ${Object.entries(content).map(([key, value]) => `
            <tr>
              <th>${escapeHtml(key)}</th>
              <td>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

const buildPdfReadyHtml = (book, sections) => {
  const departmentName = book.departmentId?.name || 'Computer Science and Engineering';
  const regulation = book.regulation || 'R24';
  const academicYear = book.academicYear || '2024-25';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(book.title)} - Curriculum Book</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e5e7eb; color: #111827; font-family: "Times New Roman", Times, serif; }
    .book { width: 210mm; margin: 0 auto; background: white; }
    
    /* Use table layout for repeating headers/footers in print */
    table.print-wrapper { width: 100%; border-collapse: collapse; border: none; margin: 0; }
    thead.print-header { display: table-header-group; }
    tfoot.print-footer { display: table-footer-group; }
    
    .page-content { padding: 0 10mm; background: white; position: relative; }
    
    /* Cover Page */
    .cover { display: flex; flex-direction: column; justify-content: space-between; text-align: center; height: 250mm; padding: 28mm 20mm 24mm; border: 2px solid #111827; outline: 4px double #111827; outline-offset: -9mm; page-break-after: always; }
    
    .footer-content { border-top: 1px solid #1f2937; padding-top: 3mm; display: flex; justify-content: space-between; font-size: 10pt; color: #1f2937; margin: 0 10mm; }
    
    h1, h2, h3, p { position: relative; z-index: 1; }
    h1 { margin: 0; color: #111827; font-size: 25pt; line-height: 1.35; text-transform: uppercase; letter-spacing: 0.02em; }
    h2 { margin: 0 0 10mm; text-align: center; color: #111827; font-size: 17pt; line-height: 1.25; text-transform: uppercase; border-bottom: 1.5px solid #111827; padding-bottom: 2mm; page-break-before: always; }
    h3 { margin: 8mm 0 3mm; color: #991b1b; text-align: center; font-size: 14pt; text-transform: uppercase; }
    p, li, td, th { font-size: 11pt; line-height: 1.42; }
    p { margin: 0 0 4mm; text-align: justify; }
    
    .content-table { position: relative; z-index: 1; width: 100%; border-collapse: collapse; margin: 4mm 0; page-break-inside: auto; }
    .content-table th, .content-table td { border: 1px solid #111827; padding: 2mm 2.5mm; vertical-align: top; }
    .content-table th { background: #f3f4f6; text-align: center; font-weight: 700; }
    
    .subtitle { font-size: 16pt; font-weight: 700; text-transform: uppercase; color: #991b1b; }
    .meta { margin-top: 9mm; font-size: 12pt; font-weight: 700; }
    .campus { font-size: 12pt; font-weight: 700; }
    .rich { position: relative; z-index: 1; }
    .rich table { font-family: inherit; width: 100%; border-collapse: collapse; }
    .rich th, .rich td { border: 1px solid #111827; padding: 2mm; }
    .rich img { max-width: 100%; }
    
    @media print {
      body { background: white; }
      .book { width: 100%; margin: 0; box-shadow: none; }
      /* The browser will automatically insert page numbers if user enables headers/footers in print dialog. We provide the fixed curriculum info here. */
    }
  </style>
</head>
<body>
  <main class="book">
    <div class="cover">
      <div>
        <h1>Program Curriculum</h1>
        <p class="meta" style="text-align:center;">for</p>
        <p class="subtitle" style="text-align:center;">B. Tech. Four Year Degree Program</p>
        <p class="meta" style="text-align:center;">(Applicable for the batches admitted from A.Y. ${escapeHtml(academicYear)})</p>
      </div>
      <div>
        <p class="subtitle" style="text-align:center;">${escapeHtml(departmentName)}</p>
        <p class="meta" style="text-align:center;">${escapeHtml(regulation)} Curriculum</p>
      </div>
      <div>
        <p class="campus" style="text-align:center;">Aditya Nagar, ADB Road, Surampalem - 533 437</p>
        <p class="campus" style="text-align:center;">Aditya University</p>
      </div>
    </div>
    
    <table class="print-wrapper">
      <thead class="print-header">
        <tr><td><div style="height: 10mm;"></div></td></tr>
      </thead>
      <tbody>
        <tr><td>
          <div class="page-content">
            ${sections.map(sectionToHtml).join('\n')}
          </div>
        </td></tr>
      </tbody>
      <tfoot class="print-footer">
        <tr><td>
          <div style="height: 15mm; display: flex; flex-direction: column; justify-content: flex-end;">
            <div class="footer-content">
              <span>B.Tech (${escapeHtml(departmentName)}) Curriculum-${escapeHtml(regulation)}</span>
              <span>Aditya University</span>
            </div>
          </div>
        </td></tr>
      </tfoot>
    </table>
  </main>
</body>
</html>`;
};

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
      departmentId,
      title,
      regulation,
      academicYear,
      filePath,
      uploadedFile: filePath,
      originalFileName: req.file.originalname,
      fileType,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadDate: new Date(),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await CurriculumSection.insertMany(buildInitialSections(newBook._id, extractedHtml));

    await CurriculumVersion.create({
      curriculumBookId: newBook._id,
      versionNumber: 1,
      content: await snapshotFor(newBook),
      editedContent: await snapshotFor(newBook),
      editedBy: req.user.id,
      modifiedBy: req.user.id,
      changeSummary: 'Initial upload',
      status: newBook.status,
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
          const updatedSection = await CurriculumSection.findOneAndUpdate(
            { _id: rawSection._id, curriculumBookId: book._id },
            section,
            { new: true, runValidators: true }
          );
          if (updatedSection?._id) retainedSectionIds.push(updatedSection._id);
        } else {
          const createdSection = await CurriculumSection.create({ ...section, curriculumBookId: book._id });
          retainedSectionIds.push(createdSection._id);
        }
      }
      await CurriculumSection.deleteMany({
        curriculumBookId: book._id,
        _id: { $nin: retainedSectionIds },
      });
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
      curriculumBookId,
      versionNumber: newVersionNumber,
      content,
      editedContent: content,
      editedBy: req.user.id,
      modifiedBy: req.user.id,
      changeSummary,
      status: book.status,
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
        ...normalizeSection(section, index),
        curriculumBookId: id,
      })));
    }

    const restoredVersionNumber = book.currentVersion + 1;
    book.currentVersion = restoredVersionNumber;
    book.status = 'Draft';
    book.updatedBy = req.user.id;
    await book.save();

    const restoredSnapshot = await snapshotFor(book);
    const restoredVersion = await CurriculumVersion.create({
      curriculumBookId: id,
      versionNumber: restoredVersionNumber,
      content: restoredSnapshot,
      editedContent: restoredSnapshot,
      editedBy: req.user.id,
      modifiedBy: req.user.id,
      changeSummary: `Restored from version ${version.versionNumber}`,
      status: book.status,
    });

    const sections = await CurriculumSection.find({ curriculumBookId: id }).sort({ orderNumber: 1 });
    return res.status(200).json({
      message: `Version ${version.versionNumber} restored as version ${restoredVersionNumber}`,
      curriculumBook: book,
      sections,
      version: restoredVersion,
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
      req.params.id,
      { status, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    const content = await snapshotFor(book);
    const version = await CurriculumVersion.create({
      curriculumBookId: book._id,
      versionNumber: book.currentVersion + 1,
      content,
      editedContent: content,
      editedBy: req.user.id,
      modifiedBy: req.user.id,
      changeSummary: `Status changed to ${status}`,
      status,
    });
    book.currentVersion = version.versionNumber;
    await book.save();

    return res.status(200).json({ message: `Curriculum book ${status.toLowerCase()}`, curriculumBook: book, version });
  } catch (error) {
    return next(error);
  }
};

export const exportPdf = async (req, res, next) => {
  try {
    const { curriculumBookId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(curriculumBookId)) {
      return res.status(400).json({ message: 'Invalid curriculum book ID' });
    }
    const book = await CurriculumBook.findById(curriculumBookId)
      .populate('departmentId', 'name code');
    if (!book) return res.status(404).json({ message: 'Curriculum book not found' });

    const sections = await CurriculumSection.find({ curriculumBookId }).sort({ orderNumber: 1 }).lean();
    const html = buildPdfReadyHtml(book, sections);

    await fs.promises.mkdir(GENERATED_DIR, { recursive: true });
    const filename = `${book._id}-v${book.currentVersion}-curriculum.html`;
    const generatedPath = path.join(GENERATED_DIR, filename);
    await fs.promises.writeFile(generatedPath, html, 'utf8');

    const publicPath = `/uploads/generated/${filename}`;
    await CurriculumVersion.findOneAndUpdate(
      { curriculumBookId, versionNumber: book.currentVersion },
      { pdfPath: publicPath, generatedPdfPath: publicPath },
      { new: true }
    );

    return res.status(200).json({
      message: 'PDF-ready curriculum book generated',
      url: publicPath,
      html,
      filename: `${book.title.replace(/[^\w.-]+/g, '_')}_v${book.currentVersion}.pdf`,
    });
  } catch (error) {
    return next(error);
  }
};
