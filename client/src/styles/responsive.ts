/**
 * 响应式设计工具
 * 提供移动端适配的样式工具和媒体查询
 */

import { css } from 'styled-components';

/**
 * 断点定义
 */
export const breakpoints = {
  xs: '480px',   // 超小屏幕（手机）
  sm: '576px',   // 小屏幕（大手机）
  md: '768px',   // 中等屏幕（平板）
  lg: '992px',   // 大屏幕（笔记本）
  xl: '1200px',  // 超大屏幕（桌面）
  xxl: '1600px', // 超超大屏幕（大屏桌面）
} as const;

/**
 * 媒体查询工具
 */
export const media = {
  xs: `@media (max-width: ${breakpoints.xs})`,
  sm: `@media (max-width: ${breakpoints.sm})`,
  md: `@media (max-width: ${breakpoints.md})`,
  lg: `@media (max-width: ${breakpoints.lg})`,
  xl: `@media (max-width: ${breakpoints.xl})`,
  xxl: `@media (max-width: ${breakpoints.xxl})`,
} as const;

/**
 * 移动端优先的媒体查询
 */
export const mediaUp = {
  sm: `@media (min-width: ${breakpoints.xs})`,
  md: `@media (min-width: ${breakpoints.sm})`,
  lg: `@media (min-width: ${breakpoints.md})`,
  xl: `@media (min-width: ${breakpoints.lg})`,
  xxl: `@media (min-width: ${breakpoints.xl})`,
} as const;

/**
 * 响应式间距
 */
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

/**
 * 响应式字体大小
 */
export const fontSize = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
  xxl: '24px',
  display: '32px',
} as const;

/**
 * 响应式布局容器
 */
export const container = css`
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 ${spacing.md};

  ${mediaUp.sm} {
    max-width: 540px;
  }

  ${mediaUp.md} {
    max-width: 720px;
  }

  ${mediaUp.lg} {
    max-width: 960px;
  }

  ${mediaUp.xl} {
    max-width: 1140px;
  }

  ${mediaUp.xxl} {
    max-width: 1320px;
  }
`;

/**
 * 响应式网格系统
 */
export const grid = {
  row: css`
    display: flex;
    flex-wrap: wrap;
    margin: 0 -${spacing.sm};
  `,
  
  col: (span: number = 12) => css`
    flex: 0 0 ${(span / 12) * 100}%;
    max-width: ${(span / 12) * 100}%;
    padding: 0 ${spacing.sm};
  `,
  
  colResponsive: (xs?: number, sm?: number, md?: number, lg?: number, xl?: number) => css`
    flex: 0 0 100%;
    max-width: 100%;
    padding: 0 ${spacing.sm};
    
    ${xs && css`
      ${media.xs} {
        flex: 0 0 ${(xs / 12) * 100}%;
        max-width: ${(xs / 12) * 100}%;
      }
    `}
    
    ${sm && css`
      ${mediaUp.sm} {
        flex: 0 0 ${(sm / 12) * 100}%;
        max-width: ${(sm / 12) * 100}%;
      }
    `}
    
    ${md && css`
      ${mediaUp.md} {
        flex: 0 0 ${(md / 12) * 100}%;
        max-width: ${(md / 12) * 100}%;
      }
    `}
    
    ${lg && css`
      ${mediaUp.lg} {
        flex: 0 0 ${(lg / 12) * 100}%;
        max-width: ${(lg / 12) * 100}%;
      }
    `}
    
    ${xl && css`
      ${mediaUp.xl} {
        flex: 0 0 ${(xl / 12) * 100}%;
        max-width: ${(xl / 12) * 100}%;
      }
    `}
  `,
};

/**
 * 移动端隐藏/显示工具
 */
export const visibility = {
  hideOnMobile: css`
    ${media.md} {
      display: none !important;
    }
  `,
  
  showOnMobile: css`
    display: none !important;
    
    ${media.md} {
      display: block !important;
    }
  `,
  
  hideOnTablet: css`
    ${media.lg} {
      display: none !important;
    }
  `,
  
  showOnTablet: css`
    display: none !important;
    
    ${media.lg} {
      display: block !important;
    }
  `,
};

/**
 * 响应式间距工具
 */
export const responsiveSpacing = {
  margin: (size: keyof typeof spacing) => css`
    margin: ${spacing[size]};
    
    ${media.md} {
      margin: ${spacing.xs};
    }
  `,
  
  padding: (size: keyof typeof spacing) => css`
    padding: ${spacing[size]};
    
    ${media.md} {
      padding: ${spacing.xs};
    }
  `,
  
  gap: (size: keyof typeof spacing) => css`
    gap: ${spacing[size]};
    
    ${media.md} {
      gap: ${spacing.xs};
    }
  `,
};

/**
 * 触摸友好的按钮/链接样式
 */
export const touchFriendly = css`
  min-height: 44px;
  min-width: 44px;
  
  ${media.md} {
    min-height: 36px;
    min-width: 36px;
  }
`;

/**
 * 响应式卡片样式
 */
export const responsiveCard = css`
  background: var(--color-bg-container);
  border-radius: 8px;
  padding: ${spacing.lg};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  ${media.md} {
    padding: ${spacing.md};
    border-radius: 6px;
  }
  
  ${media.sm} {
    padding: ${spacing.sm};
    border-radius: 4px;
  }
`;

/**
 * 响应式表格样式
 */
export const responsiveTable = css`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  
  table {
    min-width: 600px;
    
    ${media.md} {
      min-width: 100%;
    }
  }
`;

/**
 * 响应式表单样式
 */
export const responsiveForm = css`
  .ant-form-item {
    margin-bottom: ${spacing.md};
    
    ${media.md} {
      margin-bottom: ${spacing.sm};
    }
  }
  
  .ant-form-item-label {
    ${media.md} {
      padding-bottom: 4px;
    }
  }
`;

/**
 * 响应式导航样式
 */
export const responsiveNav = css`
  ${media.md} {
    .ant-layout-sider {
      position: fixed;
      z-index: 1000;
      height: 100vh;
      
      &.ant-layout-sider-collapsed {
        transform: translateX(-100%);
      }
    }
    
    .ant-layout-sider-trigger {
      position: fixed;
      bottom: 0;
      z-index: 1001;
    }
  }
`;

/**
 * 安全区域适配（刘海屏、底部手势条）
 */
export const safeArea = css`
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
`;

/**
 * 横屏模式优化
 */
export const landscape = css`
  @media (orientation: landscape) and (max-height: 500px) {
    padding: ${spacing.sm};
  }
`;

/**
 * 打印样式优化
 */
export const print = css`
  @media print {
    * {
      background: transparent !important;
      color: black !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    
    .no-print {
      display: none !important;
    }
  }
`;
