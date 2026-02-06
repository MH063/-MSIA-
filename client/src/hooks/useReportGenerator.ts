import { useCallback, useState } from 'react';
import type { FormInstance } from 'antd';
import api, { getBlob, unwrapData } from '../utils/api';
import type { ApiResponse } from '../utils/api';

export interface ReportFormat {
  format: 'markdown' | 'plaintext' | 'pdf' | 'word';
}

interface UseReportGeneratorReturn {
  generating: boolean;
  error: Error | null;
  generateMarkdown: () => Promise<string>;
  generatePlainText: () => Promise<string>;
  generatePDF: () => Promise<Blob>;
  generateWord: () => Promise<Blob>;
}

export const useReportGenerator = (
  form: FormInstance,
  sessionId: string | undefined
): UseReportGeneratorReturn => {
  void form;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateMarkdown = useCallback(async (): Promise<string> => {
    if (!sessionId || sessionId === 'new') {
      throw new Error('Session not saved yet');
    }

    setGenerating(true);
    setError(null);

    try {
      const res = (await api.get(`/sessions/${sessionId}/export/markdown`)) as ApiResponse<string | { data: string }>;
      const payload = unwrapData<string>(res);
      if (typeof payload !== 'string') throw new Error('Failed to generate markdown');
      return payload;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate markdown');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, [sessionId]);

  const generatePlainText = useCallback(async (): Promise<string> => {
    if (!sessionId || sessionId === 'new') {
      throw new Error('Session not saved yet');
    }

    setGenerating(true);
    setError(null);

    try {
      const res = (await api.get(`/sessions/${sessionId}/export/text`)) as ApiResponse<string | { data: string }>;
      const payload = unwrapData<string>(res);
      if (typeof payload !== 'string') throw new Error('Failed to generate text');
      return payload;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate text');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, [sessionId]);

  const generatePDF = useCallback(async (): Promise<Blob> => {
    if (!sessionId || sessionId === 'new') {
      throw new Error('Session not saved yet');
    }

    setGenerating(true);
    setError(null);

    try {
      const resp = await getBlob(`/sessions/${sessionId}/export/pdf`);
      return resp.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate PDF');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, [sessionId]);

  const generateWord = useCallback(async (): Promise<Blob> => {
    if (!sessionId || sessionId === 'new') {
      throw new Error('Session not saved yet');
    }

    setGenerating(true);
    setError(null);

    try {
      const resp = await getBlob(`/sessions/${sessionId}/export/word`);
      return resp.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate Word');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, [sessionId]);

  return {
    generating,
    error,
    generateMarkdown,
    generatePlainText,
    generatePDF,
    generateWord,
  };
};
