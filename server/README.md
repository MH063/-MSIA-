# MSIA 后端服务

医学生智能问诊辅助系统 - 后端 API 服务

## 技术栈

- **运行时**: Node.js 20+
- **框架**: Express 5
- **语言**: TypeScript 5
- **ORM**: Prisma 6
- **数据库**: PostgreSQL 16
- **缓存**: Redis 7

## 目录结构

```
server/
├── src/
│   ├── controllers/     # 控制器层
│   │   ├── auth.controller.ts    # 认证控制器
│   │   ├── session.controller.ts # 问诊会话控制器
│   │   ├── patient.controller.ts # 患者控制器
│   │   └── ...
│   ├── services/        # 业务逻辑层
│   ├── routes/          # 路由定义
│   ├── middleware/      # 中间件
│   │   ├── auth.ts      # 认证中间件
│   │   ├── csrf.ts      # CSRF 防护
│   │   └── rateLimit.ts # 限流中间件
│   ├── utils/           # 工具函数
│   │   ├── secureLogger.ts  # 安全日志工具
│   │   ├── security.ts      # 安全工具
│   │   └── validation.ts    # 验证工具
│   ├── config/          # 配置文件
│   │   ├── security.ts  # 安全配置
│   │   └── cors.ts      # CORS 配置
│   └── index.ts         # 入口文件
├── prisma/              # 数据库模型
│   ├── schema.prisma    # Prisma 模型定义
│   └── migrations/      # 数据库迁移
├── knowledge_base/      # 症状知识库 (JSON)
├── __tests__/           # 测试文件
├── .env.example         # 环境变量模板
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件配置必要参数
```

### 数据库迁移

```bash
npx prisma migrate dev
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
npm start
```

## 环境变量

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/MSIA` |
| `JWT_SECRET` | JWT 密钥（建议 32 位以上） | `your-secure-jwt-secret` |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `4000` |
| `NODE_ENV` | 运行环境 | `development` |
| `REDIS_URL` | Redis 连接字符串 | - |
| `ENCRYPTION_KEY` | 数据加密密钥（32 位） | - |
| `ENABLE_DEV_TOKENS` | 开发环境测试 Token | `false` |
| `ALLOWED_ORIGINS` | CORS 白名单 | `http://localhost:8000` |

### 安全相关变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LOGIN_MAX_FAILS_DOCTOR` | 医生登录失败锁定次数 | `5` |
| `LOGIN_MAX_FAILS_ADMIN` | 管理员登录失败锁定次数 | `3` |
| `LOGIN_LOCK_MS_DOCTOR` | 医生锁定时间（毫秒） | `300000` |
| `LOGIN_LOCK_MS_ADMIN` | 管理员锁定时间（毫秒） | `600000` |

## API 端点

### 认证 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| POST | `/api/auth/register` | 用户注册 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/refresh` | 刷新 Token |

### 问诊会话 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取会话列表 |
| GET | `/api/sessions/:id` | 获取会话详情 |
| POST | `/api/sessions` | 创建会话 |
| PUT | `/api/sessions/:id` | 更新会话 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| GET | `/api/sessions/stats` | 获取统计数据 |

### 患者 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/patients` | 获取患者列表 |
| GET | `/api/patients/:id` | 获取患者详情 |
| POST | `/api/patients` | 创建患者 |
| PUT | `/api/patients/:id` | 更新患者 |

### 知识库 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge/symptoms` | 获取症状列表 |
| GET | `/api/knowledge/symptoms/:id` | 获取症状详情 |

## 安全特性

### 认证安全

- **JWT Token**: 使用 JWT 进行身份验证
- **Refresh Token**: 支持令牌刷新机制
- **Cookie 安全**: 生产环境强制 HTTPS
- **登录保护**: 失败锁定 + IP 限流

### 输入安全

- **SQL 注入防护**: Prisma 参数化查询 + 输入过滤
- **XSS 防护**: 输入过滤 + 输出编码
- **CSRF 防护**: Cookie + CSRF Token 双重验证

### 开发环境安全

开发环境测试 Token 需显式启用：

```env
ENABLE_DEV_TOKENS=true
```

可用测试 Token：
- `dev-admin`: 管理员权限
- `dev-doctor`: 医生权限

**注意**: 生产环境请勿设置此变量！

## 日志系统

使用 `secureLogger` 进行统一日志记录：

```typescript
import { secureLogger } from './utils/secureLogger';

// 信息日志
secureLogger.info('[模块名] 操作描述', { metadata });

// 警告日志
secureLogger.warn('[模块名] 警告信息', { metadata });

// 错误日志
secureLogger.error('[模块名] 错误信息', { error: error.message });
```

敏感信息会自动脱敏。

## 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率
npm run test:coverage
```

## 常用命令

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start

# 数据库迁移
npx prisma migrate dev

# 数据库重置
npx prisma migrate reset

# 生成 Prisma 客户端
npx prisma generate

# 查看数据库
npx prisma studio
```

## 相关文档

- [项目主文档](../README.md)
- [前端开发文档](../client/README.md)
- [Docker 部署指南](../DOCKER_DEPLOY.md)
- [术语表](../docs/TERMINOLOGY.md)

---

**版本**: v2.2  
**最后更新**: 2026年3月
