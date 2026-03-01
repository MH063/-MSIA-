# MSIA 前端应用

医学生智能问诊辅助系统 - 前端 Web 应用

## 技术栈

- **框架**: React 19
- **语言**: TypeScript 5.9
- **构建工具**: Vite 7
- **UI 组件库**: Ant Design 6
- **状态管理**: Zustand 5
- **网络请求**: Axios + React Query 5
- **图表**: ECharts 6 + D3 7
- **测试框架**: Vitest 3

## 目录结构

```
client/
├── src/
│   ├── pages/           # 页面组件
│   │   ├── Home/            # 首页
│   │   ├── Login/           # 登录页
│   │   ├── Interview/       # 问诊模块
│   │   ├── SessionList/     # 会话列表
│   │   ├── PatientList/     # 患者列表
│   │   ├── KnowledgeList/   # 知识库列表
│   │   └── DiagnosisList/   # 诊断列表
│   ├── components/      # 通用组件
│   ├── layouts/         # 布局组件
│   │   └── MainLayout.tsx   # 主布局
│   ├── store/           # 状态管理 (Zustand)
│   ├── utils/           # 工具函数
│   │   ├── api.ts           # API 请求封装
│   │   ├── logger.ts        # 日志工具
│   │   └── helpers.ts       # 辅助函数
│   ├── config/          # 配置文件
│   │   └── index.ts         # 全局配置
│   ├── hooks/           # 自定义 Hooks
│   ├── types/           # 类型定义
│   ├── App.tsx          # 应用入口
│   └── main.tsx         # 渲染入口
├── public/              # 静态资源
├── __tests__/           # 测试文件
├── Dockerfile           # Docker 构建配置
├── nginx.conf           # Nginx 配置
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 环境变量

在项目根目录创建 `.env` 文件：

```env
# API 基础地址
VITE_API_BASE_URL=/api
```

## 页面说明

### 登录页面 (`/login`)

支持两种登录方式：
- **账号密码登录**: 使用用户名和密码
- **Token 登录**: 仅开发环境可见

### 首页 (`/`)

- 系统概览
- 快速入口
- 统计数据

### 问诊页面 (`/interview/:sessionId`)

- 患者信息录入
- 主诉解析
- 现病史采集
- 既往史/个人史/家族史
- 体格检查
- 智能诊断建议

### 会话列表 (`/sessions`)

- 问诊会话管理
- 搜索和筛选
- 状态追踪

### 患者列表 (`/patients`)

- 患者信息管理
- 历史记录查看

### 知识库 (`/knowledge`)

- 症状知识库
- 诊断参考

## 组件规范

### 命名规范

- 组件文件: PascalCase (如 `InterviewPage.tsx`)
- 样式文件: 同名 (如 `InterviewPage.module.css`)
- 工具函数: camelCase (如 `formatDate.ts`)

### 组件结构

```tsx
import React from 'react';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

/**
 * 组件说明
 */
export const MyComponent: React.FC<MyComponentProps> = ({ title, onAction }) => {
  return (
    <div>
      {/* 组件内容 */}
    </div>
  );
};
```

## API 请求

使用 `api.ts` 封装的请求工具：

```typescript
import { api } from '@/utils/api';

// GET 请求
const response = await api.get('/sessions');

// POST 请求
const response = await api.post('/sessions', { data });

// 处理响应
if (response.success) {
  const data = response.data;
}
```

### 响应结构

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}
```

## 状态管理

使用 Zustand 进行状态管理：

```typescript
import { create } from 'zustand';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

## 测试

```bash
# 运行测试
npm test

# 运行测试并监听变化
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 常用命令

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint

# 运行测试
npm test
```

## 相关文档

- [项目主文档](../README.md)
- [后端开发文档](../server/README.md)
- [Docker 部署指南](../DOCKER_DEPLOY.md)
- [术语表](../docs/TERMINOLOGY.md)

---

**版本**: v2.2  
**最后更新**: 2026年3月
