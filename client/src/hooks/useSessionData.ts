import { useState, useEffect, useCallback } from 'react';
import api, { unwrapData } from '../utils/api';
import type { ApiResponse } from '../utils/api';

export interface SessionData {
  id?: number;
  patientId?: number;
  doctorId?: number | null;
  status?: string;
  historian?: string;
  reliability?: string;
  historianRelationship?: string;
  generalInfo?: Record<string, unknown>;
  chiefComplaint?: Record<string, unknown>;
  presentIllness?: Record<string, unknown>;
  pastHistory?: Record<string, unknown>;
  personalHistory?: Record<string, unknown>;
  maritalHistory?: Record<string, unknown>;
  menstrualHistory?: Record<string, unknown>;
  fertilityHistory?: Record<string, unknown>;
  familyHistory?: Record<string, unknown>;
  physicalExam?: Record<string, unknown>;
  specialistExam?: Record<string, unknown>;
  auxiliaryExams?: Record<string, unknown>;
  reviewOfSystems?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface UseSessionDataReturn {
  data: SessionData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useSessionData = (id: string | undefined): UseSessionDataReturn => {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || id === 'new') {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = (await api.get(`/sessions/${id}`)) as ApiResponse<SessionData | { data: SessionData }>;
      const sessionData = unwrapData<SessionData>(res) || null;
      setData(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch session'));
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
