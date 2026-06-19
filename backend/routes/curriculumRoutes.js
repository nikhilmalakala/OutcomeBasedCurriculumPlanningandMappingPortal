import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import * as curriculumController from '../controllers/curriculumController.js';

const router = express.Router();
router.use(authenticateJWT);

router.get('/:regulationId/summary', curriculumController.getCurriculumSummary);
router.get('/:regulationId/semester/:semester', curriculumController.getSemesterCourses);
router.get('/:regulationId', curriculumController.getCurriculumByRegulation);

export default router;

