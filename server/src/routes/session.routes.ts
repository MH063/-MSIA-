import { Router } from 'express';
import * as sessionController from '../controllers/session.controller';

const router = Router();

router.get('/stats', sessionController.getDashboardStats);
router.get('/', sessionController.getAllSessions);
router.post('/', sessionController.createSession);
router.get('/:id', sessionController.getSession);
router.delete('/:id', sessionController.deleteSession);
router.post('/bulk-delete', sessionController.deleteSessionsBulk);
router.patch('/:id', sessionController.updateSession);
router.post('/:id/report', sessionController.generateReport);

export default router;
