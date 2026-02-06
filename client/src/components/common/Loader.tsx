import React from 'react';
import styled from 'styled-components';

type LoaderProps = {
  fullscreen?: boolean;
  percent?: number;
};

/**
 * Loader
 * 居中显示的进度条加载动画，保持用户提供的视觉样式不变，并进行性能优化：
 * - 使用 transform: scaleX 动画替代 width 动画，减少重排与卡顿
 * - 添加 will-change 与 translateZ(0) 启用合成层
 * - 使用 contain 隔离布局与绘制范围
 * - 支持全屏居中覆盖（fullscreen）
 */
const Loader: React.FC<LoaderProps> = ({ fullscreen = false, percent = 100 }) => {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const styleVar = { ['--percent' as string]: `${pct}%` } as React.CSSProperties;
  return (
    <StyledWrapper data-fullscreen={fullscreen} style={styleVar} aria-busy="true" aria-live="polite">
      <div className="progress-container">
        <div className="progress-bar" />
        <div className="progress-text">{pct}%</div>
        <div className="particles">
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  pointer-events: none;

  &[data-fullscreen='true'] {
    position: fixed;
    inset: 0;
    min-height: 100vh;
    z-index: 9999;
    background: transparent;
  }

  .progress-container {
    position: relative;
    width: 60%;
    max-width: 500px;
    height: 20px;
    background: radial-gradient(circle, #1b2735, #090a0f);
    border-radius: 30px;
    overflow: hidden;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
    box-sizing: border-box;
    border: 1px solid #313131;
    contain: layout paint style;
    will-change: transform;
    transform: translateZ(0);
  }

  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: var(--percent);
    background: linear-gradient(90deg, #00f260, #0575e6);
    border-radius: 30px;
    box-shadow:
      0 0 15px #00f260,
      0 0 30px #0575e6;
    transform-origin: left center;
    transform: scaleX(0) translateZ(0);
    will-change: transform, opacity;
    animation: grow 3s ease-in-out forwards;
  }

  .progress-bar::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) translateZ(0);
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.15), transparent);
    opacity: 0.5;
    animation: ripple 3s infinite;
    will-change: transform, opacity;
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) translateZ(0);
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1px;
    color: #fff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
    z-index: 2;
  }

  .particles {
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;
    contain: strict;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #fff;
    border-radius: 50%;
    opacity: 0.6;
    animation: float 5s infinite ease-in-out;
    will-change: transform, opacity;
    transform: translateZ(0);
  }

  @keyframes grow {
    0% { transform: scaleX(0) translateZ(0); opacity: 0.8; }
    100% { transform: scaleX(1) translateZ(0); opacity: 1; }
  }

  @keyframes ripple {
    0% {
      transform: translate(-50%, -50%) scale(0.5) translateZ(0);
      opacity: 0.7;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.5) translateZ(0);
      opacity: 0;
    }
  }

  @keyframes float {
    0% { transform: translateY(0) translateX(0) translateZ(0); }
    50% { transform: translateY(-20px) translateX(10px) translateZ(0); }
    100% { transform: translateY(0) translateX(0) translateZ(0); }
  }

  .particle:nth-child(1) { top: 10%; left: 20%; animation-delay: 0s; }
  .particle:nth-child(2) { top: 30%; left: 70%; animation-delay: 1s; }
  .particle:nth-child(3) { top: 50%; left: 50%; animation-delay: 2s; }
  .particle:nth-child(4) { top: 80%; left: 40%; animation-delay: 1.5s; }
  .particle:nth-child(5) { top: 90%; left: 60%; animation-delay: 2.5s; }

  @media (prefers-reduced-motion: reduce) {
    .progress-bar { animation-duration: 4.5s; }
    .particles .particle { animation-duration: 7s; }
  }
`;

export default Loader;
