import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useResponsive,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useViewportHeight,
} from '../useResponsive';

const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

describe('useResponsive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      value: originalInnerHeight,
    });
  });

  it('应该返回当前窗口尺寸', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it('应该正确识别移动端', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('应该正确识别平板端', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 600 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('应该正确识别桌面端', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it('应该正确识别横屏模式', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isLandscape).toBe(true);
    expect(result.current.isPortrait).toBe(false);
  });

  it('应该正确识别竖屏模式', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 1024 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('应该在窗口大小变化时更新状态', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.isMobile).toBe(true);
  });
});

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该返回正确的移动端状态', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });
});

describe('useIsTablet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该返回正确的平板端状态', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });

    const { result } = renderHook(() => useIsTablet());

    expect(result.current).toBe(true);
  });
});

describe('useIsDesktop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该返回正确的桌面端状态', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 });

    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(true);
  });
});

describe('useViewportHeight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该返回当前视口高度', () => {
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { result } = renderHook(() => useViewportHeight());

    expect(result.current).toBe(800);
  });

  it('应该在窗口大小变化时更新高度', () => {
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { result } = renderHook(() => useViewportHeight());

    expect(result.current).toBe(800);

    act(() => {
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 600 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(600);
  });
});
