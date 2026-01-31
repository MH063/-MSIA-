import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Form } from 'antd';
import type { FormInstance } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as MediaQueryList),
      writable: true,
    });
  }
  if (!('ResizeObserver' in window)) {
    (window as unknown as {
      ResizeObserver: new (cb: ResizeObserverCallback) => ResizeObserver;
    }).ResizeObserver = class {
      observe(target: Element) { void target; }
      unobserve(target: Element) { void target; }
      disconnect() {}
    };
  }
});
vi.mock('../../../../../utils/api', () => {
  const mockApi = {
    get: async () => ({
      success: true,
      data: {
        synonyms: {},
        nameToKey: {
          发热: 'fever',
          咳嗽: 'cough',
        },
      },
    }),
    post: async () => ({ success: true, data: {} }),
    patch: async () => ({ success: true, data: {} }),
  };
  return {
    default: mockApi,
    unwrapData: (res: unknown) => {
      const payload = (res as { data?: unknown } | undefined)?.data;
      if (!payload) return undefined;
      if (typeof payload === 'object' && payload !== null && 'data' in (payload as { data: unknown })) {
        return (payload as { data: unknown }).data;
      }
      return payload;
    },
  };
});
import EditorPanel from '../EditorPanel';
import dayjs from 'dayjs';

afterEach(() => {
  cleanup();
});

const renderWithForm = async (section: string, initial?: Record<string, unknown>) => {
  let captured: FormInstance | null = null;
  const Harness = ({ s, init }: { s: string; init?: Record<string, unknown> }) => {
    const [form] = Form.useForm();
    const [queryClient] = React.useState(() => new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    }));
    React.useEffect(() => {
      captured = form;
      if (init) form.setFieldsValue(init);
    }, [form, init]);
    return (
      <QueryClientProvider client={queryClient}>
        <Form form={form}>
          <EditorPanel currentSection={s} disableConfirm />
        </Form>
      </QueryClientProvider>
    );
  };
  render(<Harness s={section} init={initial} />);
  await waitFor(() => {
    if (!captured) throw new Error('form not ready');
  });
  return captured!;
};

describe('EditorPanel section reset', () => {
  it('resets General section fields only', async () => {
    const form = await renderWithForm('general', {
      name: '张三',
      gender: '男',
      birthDate: dayjs('2000-01-01'),
      historian: '家属',
      historianRelationship: '父亲',
    });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue('name')).toBeUndefined();
    expect(form.getFieldValue('historian')).toBe('本人');
    expect(form.getFieldValue('historianRelationship')).toBeUndefined();
  });

  it('resets Chief Complaint section', async () => {
    const form = await renderWithForm('chief_complaint', { chiefComplaint: { symptom: '发热', durationNum: 3, durationUnit: '天' } });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['chiefComplaint', 'symptom'])).toBeUndefined();
    expect(form.getFieldValue(['chiefComplaint', 'durationNum'])).toBeUndefined();
  });

  it('resets HPI section', async () => {
    const form = await renderWithForm('hpi', { presentIllness: { associatedSymptoms: ['fever', 'cough'], onsetTime: '昨日' } });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['presentIllness', 'associatedSymptoms'])).toBeUndefined();
    expect(form.getFieldValue(['presentIllness', 'onsetTime'])).toBeUndefined();
  });

  it('resets Past History section and keeps initial values', async () => {
    const form = await renderWithForm('past_history', {
      pastHistory: {
        generalHealth: 'poor',
        vaccinationHistory: '按计划接种',
        surgeries: [{ name: '阑尾切除' }],
      },
    });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['pastHistory', 'vaccinationHistory'])).toBeUndefined();
    expect(form.getFieldValue(['pastHistory', 'surgeries'])).toBeUndefined();
    expect(form.getFieldValue(['pastHistory', 'generalHealth'])).toBe('good');
  });

  it('resets Personal History nested fields only', async () => {
    const form = await renderWithForm('personal_history', {
      occupation: '医生',
      personalHistory: { alcohol_status: '饮酒', drinkVolume: 200, alcoholDegree: 40 },
    });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['personalHistory', 'drinkVolume'])).toBeUndefined();
    expect(form.getFieldValue(['personalHistory', 'alcohol_status'])).toBe('从不');
    expect(form.getFieldValue('occupation')).toBe('医生');
  });

  it('resets Marital/Menstrual/Fertility section', async () => {
    const form = await renderWithForm('marital_history', {
      maritalHistory: { status: '已婚' },
      menstrualHistory: { age: 14, cycle: 28 },
      fertilityHistory: { term: 1, preterm: 0, abortion: 0, living: 2 },
    });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['maritalHistory', 'status'])).toBeUndefined();
    expect(form.getFieldValue(['menstrualHistory', 'age'])).toBeUndefined();
    expect(form.getFieldValue(['fertilityHistory', 'term'])).toBeUndefined();
  });

  it('resets Family History section', async () => {
    const form = await renderWithForm('family_history', { familyHistory: { father: '健康', mother: '高血压' } });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['familyHistory', 'father'])).toBeUndefined();
    expect(form.getFieldValue(['familyHistory', 'mother'])).toBeUndefined();
  });

  it('resets Review of Systems section', async () => {
    const form = await renderWithForm('review_of_systems', { reviewOfSystems: { respiratory: { symptoms: ['咳嗽'] } } });
    fireEvent.click(screen.getByTestId('reset-section'));
    expect(form.getFieldValue(['reviewOfSystems', 'respiratory', 'symptoms'])).toBeUndefined();
  });
});
