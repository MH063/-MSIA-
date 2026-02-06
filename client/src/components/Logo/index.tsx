import React from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ width = 44, height = 44, className }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 背景圆形 - 半透明白色 */}
      <circle cx="100" cy="100" r="90" fill="white" fillOpacity="0.15" />
      
      {/* 听诊器 - 左侧，白色粗线条 */}
      <path
        d="M40 145 C40 145, 30 120, 30 95 C30 65, 48 48, 65 48"
        stroke="white"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M65 48 L70 43"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* 听诊器胸件 */}
      <circle cx="40" cy="150" r="14" stroke="white" strokeWidth="6" fill="none" />
      <circle cx="40" cy="150" r="7" fill="#69c0ff" />
      
      {/* 病历夹 - 右侧 */}
      <rect x="100" y="30" width="60" height="80" rx="8" stroke="white" strokeWidth="6" fill="none" />
      {/* 病历夹夹子 */}
      <rect x="115" y="22" width="30" height="12" rx="4" fill="white" />
      
      {/* 病历夹上的勾选框 - 蓝色 */}
      <rect x="110" y="48" width="14" height="14" rx="3" stroke="#69c0ff" strokeWidth="4" fill="none" />
      <path d="M113 55 L118 60 L125 51" stroke="#69c0ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      
      <rect x="110" y="72" width="14" height="14" rx="3" stroke="#69c0ff" strokeWidth="4" fill="none" />
      <path d="M113 79 L118 84 L125 75" stroke="#69c0ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 病历夹上的横线 - 浅灰色 */}
      <line x1="130" y1="55" x2="150" y2="55" stroke="#d9d9d9" strokeWidth="4" strokeLinecap="round" />
      <line x1="130" y1="79" x2="150" y2="79" stroke="#d9d9d9" strokeWidth="4" strokeLinecap="round" />
      <line x1="110" y1="98" x2="150" y2="98" stroke="#d9d9d9" strokeWidth="4" strokeLinecap="round" />
      
      {/* MSIA 文字 - 白色粗体 */}
      <text
        x="100"
        y="170"
        textAnchor="middle"
        fill="white"
        fontSize="32"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        letterSpacing="2"
      >
        MSIA
      </text>
      
      {/* 大脑图标 - 右下，简化版 */}
      <path
        d="M145 115 C145 115, 160 110, 170 120 C180 130, 175 148, 165 153 C155 158, 145 153, 140 148"
        stroke="white"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* 大脑纹理 */}
      <path
        d="M150 125 C150 125, 155 122, 160 128"
        stroke="#69c0ff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="155" cy="138" r="3" fill="#69c0ff" />
      
      {/* 齿轮 - 左下，简化版 */}
      <circle cx="75" cy="135" r="16" stroke="white" strokeWidth="5" fill="none" />
      <circle cx="75" cy="135" r="7" fill="#69c0ff" />
      {/* 齿轮齿 */}
      <line x1="75" y1="113" x2="75" y2="119" stroke="white" strokeWidth="5" strokeLinecap="round" />
      <line x1="75" y1="151" x2="75" y2="157" stroke="white" strokeWidth="5" strokeLinecap="round" />
      <line x1="53" y1="135" x2="59" y2="135" stroke="white" strokeWidth="5" strokeLinecap="round" />
      <line x1="91" y1="135" x2="97" y2="135" stroke="white" strokeWidth="5" strokeLinecap="round" />
      
      {/* 连接线 - 虚线 */}
      <path
        d="M92 145 Q100 150, 108 145"
        stroke="#69c0ff"
        strokeWidth="3"
        fill="none"
        strokeDasharray="5 3"
      />
      
      {/* 小加号装饰 - 蓝色 */}
      <line x1="175" y1="55" x2="175" y2="67" stroke="#69c0ff" strokeWidth="4" strokeLinecap="round" />
      <line x1="169" y1="61" x2="181" y2="61" stroke="#69c0ff" strokeWidth="4" strokeLinecap="round" />
      
      <line x1="25" y1="75" x2="25" y2="85" stroke="#69c0ff" strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="80" x2="30" y2="80" stroke="#69c0ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

export default Logo;
