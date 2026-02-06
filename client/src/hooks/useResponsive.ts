/**
 * 响应式 Hook
 * 提供移动端检测和响应式状态管理
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * 断点定义
 */
const breakpoints = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
} as const;

type Breakpoint = keyof typeof breakpoints;

/**
 * 响应式状态
 */
interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  breakpoint: Breakpoint | 'xs' | 'xxl';
}

/**
 * 获取当前断点
 */
const getBreakpoint = (width: number): Breakpoint | 'xs' | 'xxl' => {
  if (width < breakpoints.xs) return 'xs';
  if (width < breakpoints.sm) return 'sm';
  if (width < breakpoints.md) return 'md';
  if (width < breakpoints.lg) return 'lg';
  if (width < breakpoints.xl) return 'xl';
  if (width < breakpoints.xxl) return 'xl';
  return 'xxl';
};

/**
 * 响应式 Hook
 */
export const useResponsive = (): ResponsiveState => {
  const [state, setState] = useState<ResponsiveState>(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      isMobile: width < breakpoints.md,
      isTablet: width >= breakpoints.md && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      isPortrait: height > width,
      isLandscape: width > height,
      breakpoint: getBreakpoint(width),
    };
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      // 防抖处理
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        setState({
          width,
          height,
          isMobile: width < breakpoints.md,
          isTablet: width >= breakpoints.md && width < breakpoints.lg,
          isDesktop: width >= breakpoints.lg,
          isPortrait: height > width,
          isLandscape: width > height,
          breakpoint: getBreakpoint(width),
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
};

/**
 * 移动端检测 Hook
 */
export const useIsMobile = (): boolean => {
  const { isMobile } = useResponsive();
  return isMobile;
};

/**
 * 平板检测 Hook
 */
export const useIsTablet = (): boolean => {
  const { isTablet } = useResponsive();
  return isTablet;
};

/**
 * 桌面端检测 Hook
 */
export const useIsDesktop = (): boolean => {
  const { isDesktop } = useResponsive();
  return isDesktop;
};

/**
 * 断点检测 Hook
 */
export const useBreakpoint = (breakpoint: Breakpoint): boolean => {
  const { width } = useResponsive();
  return width >= breakpoints[breakpoint];
};

/**
 * 触摸设备检测
 */
export const useIsTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error msMaxTouchPoints is non-standard
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
      );
    };

    checkTouch();
  }, []);

  return isTouch;
};

/**
 * 安全区域 Hook（刘海屏适配）
 */
export const useSafeArea = () => {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const styles = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(styles.getPropertyValue('--safe-area-top') || '0', 10),
        bottom: parseInt(styles.getPropertyValue('--safe-area-bottom') || '0', 10),
        left: parseInt(styles.getPropertyValue('--safe-area-left') || '0', 10),
        right: parseInt(styles.getPropertyValue('--safe-area-right') || '0', 10),
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);

    return () => window.removeEventListener('resize', updateSafeArea);
  }, []);

  return safeArea;
};

/**
 * 视口高度 Hook（解决移动端键盘弹出时 vh 问题）
 */
export const useViewportHeight = (): number => {
  const [vh, setVh] = useState(window.innerHeight);

  useEffect(() => {
    const updateVh = () => {
      setVh(window.innerHeight);
    };

    window.addEventListener('resize', updateVh);
    window.addEventListener('orientationchange', updateVh);

    return () => {
      window.removeEventListener('resize', updateVh);
      window.removeEventListener('orientationchange', updateVh);
    };
  }, []);

  return vh;
};

/**
 * 滚动方向检测 Hook
 */
export const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const updateScrollDirection = () => {
      const currentScrollY = window.scrollY;
      const direction = currentScrollY > lastScrollY ? 'down' : 'up';

      if (
        direction !== scrollDirection &&
        Math.abs(currentScrollY - lastScrollY) > 10
      ) {
        setScrollDirection(direction);
      }

      lastScrollY = currentScrollY;
      setScrollY(currentScrollY);
    };

    window.addEventListener('scroll', updateScrollDirection, { passive: true });

    return () => window.removeEventListener('scroll', updateScrollDirection);
  }, [scrollDirection]);

  return { scrollDirection, scrollY };
};

/**
 * 底部导航栏显示/隐藏 Hook
 */
export const useBottomNavVisible = (threshold: number = 100): boolean => {
  const { scrollDirection, scrollY } = useScrollDirection();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (scrollY < threshold) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } else if (scrollDirection === 'down') {
      setVisible(false);
    } else if (scrollDirection === 'up') {
      setVisible(true);
    }
  }, [scrollDirection, scrollY, threshold]);

  return visible;
};

/**
 * 双击缩放禁用 Hook
 */
export const useDisableDoubleTapZoom = () => {
  useEffect(() => {
    let lastTouchEnd = 0;

    const handleTouchEnd = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
};

/**
 * 长按检测 Hook
 */
export const useLongPress = (
  callback: () => void,
  ms: number = 500
) => {
  const [startLongPress, setStartLongPress] = useState(false);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    if (startLongPress) {
      timerId = setTimeout(callback, ms);
    }

    return () => {
      clearTimeout(timerId);
    };
  }, [startLongPress, callback, ms]);

  const onMouseDown = useCallback(() => setStartLongPress(true), []);
  const onMouseUp = useCallback(() => setStartLongPress(false), []);
  const onMouseLeave = useCallback(() => setStartLongPress(false), []);
  const onTouchStart = useCallback(() => setStartLongPress(true), []);
  const onTouchEnd = useCallback(() => setStartLongPress(false), []);

  return {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
  };
};

/**
 * 拖拽检测 Hook
 */
export const useSwipe = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold: number = 50
) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe) {
      if (distanceX > threshold && onSwipeLeft) {
        onSwipeLeft();
      } else if (distanceX < -threshold && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      if (distanceY > threshold && onSwipeUp) {
        onSwipeUp();
      } else if (distanceY < -threshold && onSwipeDown) {
        onSwipeDown();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};

export default useResponsive;
