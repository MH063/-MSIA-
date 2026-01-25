import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';

const router = Router();

router.get('/', patientController.getPatients);
router.post('/', patientController.createPatient);
router.delete('/:id', patientController.deletePatient);

export default router;
