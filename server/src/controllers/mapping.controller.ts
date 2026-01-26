import { Request, Response } from 'express';
import { SYMPTOM_SYNONYMS, SYMPTOM_NAME_TO_KEY } from '../services/mapping.service';

export const getSymptomMappings = async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      synonyms: SYMPTOM_SYNONYMS,
      nameToKey: SYMPTOM_NAME_TO_KEY
    }
  });
};
