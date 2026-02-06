import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import type { ModalProps } from 'antd';

vi.mock('../../../../../components/lazy/LazyModal', async () => {
  const antd = await import('antd');
  const MockLazyModal = (props: ModalProps) => <antd.Modal {...props} />;
  return { default: MockLazyModal };
});

vi.mock('../../../../../components/LazyMarkdown', () => ({
  default: ({ content }: { content: string }) => <div data-testid="preview-md">{content}</div>,
}));

vi.mock('../../../components/Layout/InterviewLayout', () => ({
  default: ({ editor }: { editor: React.ReactNode }) => <div>{editor}</div>,
}));

vi.mock('../../../components/Navigation/NavigationPanel', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/Editor/EditorPanel', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/Assistant/AssistantOverlay', () => ({
  default: () => null,
}));

vi.mock('../../../../../utils/api', () => {
  const api = {
    get: vi.fn(async (url: string) => {
      if (url === '/mapping/symptoms') {
        return { success: true, data: { synonyms: {}, nameToKey: {} } };
      }
      if (typeof url === 'string' && url.startsWith('/sessions/')) {
        return {
          success: true,
          data: {
            patient: { name: '张三', gender: '男', birthDate: '2000-01-01', contactInfo: { phone: '123' } },
            generalInfo: {},
          },
        };
      }
      return { success: true, data: {} };
    }),
    post: vi.fn(async () => ({ success: true, data: {} })),
    patch: vi.fn(async () => ({ success: true, data: {} })),
  };

  return {
    default: api,
    getBlob: vi.fn(async () => ({ data: new Blob(), headers: {} })),
    unwrapData: <T,>(res: { data?: T | { data: T } } | undefined): T | undefined => {
      const payload = res?.data;
      if (!payload) return undefined;
      if (typeof payload === 'object' && payload !== null && 'data' in (payload as { data: T })) {
        return (payload as { data: T }).data;
      }
      return payload as T;
    },
  };
});

import Session from '../../../Session';

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
    (window as unknown as { ResizeObserver: new (cb: ResizeObserverCallback) => ResizeObserver }).ResizeObserver = class {
      observe(target: Element) { void target; }
      unobserve(target: Element) { void target; }
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
});

describe('病历预览关闭交互', () => {
  it('点击外部、按ESC、浏览器回退均不会关闭；仅点击关闭按钮可退出；右上角X不可见', async () => {
    render(
      <AntdApp>
        <MemoryRouter initialEntries={['/interview/65']}>
          <Routes>
            <Route path="/interview/:id" element={<Session />} />
          </Routes>
        </MemoryRouter>
      </AntdApp>
    );

    const previewBtn = await screen.findByRole('button', { name: /预览病历/u });
    fireEvent.click(previewBtn);

    await screen.findByRole('dialog');
    expect(screen.queryByText('病历预览')).not.toBeNull();

    expect(document.querySelector('.ant-modal-close')).toBeNull();

    const wrap = document.querySelector('.ant-modal-wrap');
    expect(wrap).not.toBeNull();
    if (wrap) {
      fireEvent.mouseDown(wrap);
      fireEvent.click(wrap);
    }
    expect(screen.queryByText('病历预览')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('病历预览')).not.toBeNull();

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(screen.queryByText('病历预览')).not.toBeNull();

    const footer = document.querySelector('.ant-modal-footer');
    expect(footer).not.toBeNull();
    const btns = footer?.querySelectorAll('button') || [];
    expect(btns.length).toBeGreaterThan(0);
    fireEvent.click(btns[0]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
