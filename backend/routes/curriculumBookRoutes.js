import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import * as curriculumBookController from '../controllers/curriculumBookController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
router.use(authenticateJWT);

const uploadDir = path.resolve('uploads', 'curriculum-books');
fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeBaseName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^\w.-]+/g, '-');
    cb(null, `${Date.now()}-${safeBaseName}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || ext === '.pdf';
    const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx';
    if (isPdf || isDocx) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX curriculum books are allowed.'));
    }
  }
});

router.post('/upload', authorizeRoles('HOD', 'Admin'), upload.single('curriculumFile'), curriculumBookController.uploadCurriculum);
router.get('/list', curriculumBookController.listCurriculums);
router.get('/version/history', curriculumBookController.getVersionHistory);
router.post('/version/create', authorizeRoles('HOD', 'Admin'), curriculumBookController.createVersion);
router.post('/export/pdf', authorizeRoles('HOD', 'Admin'), curriculumBookController.exportPdf);
router.get('/live-preview', curriculumBookController.livePreview);
router.get('/credit-summary', curriculumBookController.creditSummary);

router.get('/:id', curriculumBookController.getCurriculum);
router.put('/:id', authorizeRoles('HOD', 'Admin'), curriculumBookController.updateCurriculum);
router.put('/:id/status', authorizeRoles('HOD', 'Admin'), curriculumBookController.updateStatus);
router.post('/:id/versions/:versionId/restore', authorizeRoles('HOD', 'Admin'), curriculumBookController.restoreVersion);
router.delete('/:id', authorizeRoles('HOD', 'Admin'), curriculumBookController.deleteCurriculum);

export default router;
