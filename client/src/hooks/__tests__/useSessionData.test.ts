import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSessionData } from '../useSessionData';
import * as apiModule from '../../utils/api';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const api = vi.mocked(apiModule.default);

describe('useSessionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该在 id 为空时返回 null', async () => {
    const { result } = renderHook(() => useSessionData(undefined));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('应该在 id 为 "new" 时返回 null', async () => {
    const { result } = renderHook(() => useSessionData('new'));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('应该在有效 id 时发起请求', async () => {
    const mockData = {
      id: 1,
      patientId: 1,
      status: 'draft',
      historian: '患者本人',
    };

    api.get.mockImplementation(async () => ({
      data: { success: true, data: mockData },
    }));

    renderHook(() => useSessionData('1'));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/sessions/1');
    });
  });

  it('应该处理 API 错误', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useSessionData('1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network Error');
  });

  it('应该提供 refetch 函数', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { id: 1 } } });

    const { result } = renderHook(() => useSessionData('1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('refetch 应该重新调用 API', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { id: 1 } } });

    const { result } = renderHook(() => useSessionData('1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    const initialCallCount = api.get.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.get.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
