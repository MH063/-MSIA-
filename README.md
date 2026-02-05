# 医学生智能问诊辅助系统 (MSIA)

[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

> Medical Student Interview Assistant - 基于 Web 的智能引导式问诊辅助工具

## 项目简介

**医学生智能问诊辅助系统（MSIA）** 是为医学生和初级临床医生开发的智能问诊工具。系统通过结构化问诊清单、症状知识库和智能提示，帮助用户系统性地完成病史采集，避免遗漏关键信息，提高问诊效率和病历书写质量。

### 核心价值

- **教学价值**：帮助医学生建立系统化问诊思维
- **临床价值**：减少信息遗漏，提高病史采集完整性
- **效率价值**：结构化数据输入，自动生成病历草稿

## 功能特性

### 已实现功能 ✅

| 功能模块 | 描述 |
|---------|------|
| **智能导航与进度管理** | 侧边栏导航显示问诊结构树，实时显示各模块完成状态 |
| **患者信息管理** | 基本信息录入、自动年龄计算、数据可靠性评估 |
| **主诉智能解析** | 主诉文本输入、结构化展示、关键词提取 |
| **现病史动态问诊引擎** | 42种症状知识库、动态问题生成、HPI结构化录入 |
| **完整病史采集** | 既往史、个人史、婚育史/月经史、家族史、系统回顾 |
| **体格检查记录** | 一般情况检查、专科检查录入、辅助检查记录 |
| **智能诊断辅助** | 智能诊断建议、症状关联图谱、鉴别诊断要点 |
| **医学知识库** | 集成智能助手、知识面板展示 |
| **数据管理** | 问诊会话列表、患者列表管理、数据持久化存储 |

### 技术栈

**前端 (Frontend)**
- React 19 + TypeScript 5
- Vite 7 构建工具
- Ant Design 6 UI组件库
- Zustand 状态管理
- Axios + React Query 网络请求
- Vitest 测试框架

**后端 (Backend)**
- Node.js 20 + Express 5
- TypeScript 5
- Prisma 7 ORM
- PostgreSQL 16 数据库
- Redis 7 缓存

**部署 (Deployment)**
- Docker + Docker Compose
- Nginx 反向代理

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 16+
- Docker 20.10+ (可选，推荐)

### Docker 部署（推荐）

```bash
# 1. 克隆项目并进入目录
git clone <repository-url>
cd 医学生智能问诊辅助系统（MSIA）

# 2. 配置环境变量
cp .env.docker .env
# 编辑 .env 文件，修改 DB_PASSWORD 和 OPERATOR_TOKEN

# 3. 执行部署脚本
chmod +x deploy.sh
./deploy.sh

# 4. 访问应用
# 前端: http://localhost
# API: http://localhost:4000
```

### 手动部署

**后端服务 (Backend)**
```bash
cd server
npm install
npx prisma migrate deploy
npm run build
npm start
```

**前端应用 (Frontend)**
```bash
cd client
npm install
npm run build
# 使用 nginx 或其他服务器托管 dist 目录
```

## 项目结构

```
医学生智能问诊辅助系统（MSIA）/
├── client/                 # 前端应用 (React + Vite)
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   │   ├── Home/           # 首页
│   │   │   ├── Interview/      # 问诊模块
│   │   │   ├── KnowledgeList/  # 知识库列表
│   │   │   └── SessionList/    # 会话列表
│   │   ├── store/         # 状态管理
│   │   └── utils/         # 工具函数
│   ├── Dockerfile         # 前端容器配置
│   └── nginx.conf         # Nginx配置
│
├── server/                 # 后端服务 (Express + Prisma)
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── services/      # 业务逻辑
│   │   ├── routes/        # 路由定义
│   │   └── middleware/    # 中间件
│   ├── prisma/            # 数据库模型和迁移
│   ├── knowledge_base/    # 42种症状知识库(JSON)
│   └── Dockerfile         # 后端容器配置
│
├── deploy/                 # 部署配置
│   ├── README.md          # 生产部署指南
│   └── docker-deploy.md   # Docker部署说明
│
├── docs/                   # 项目文档
│   ├── TERMINOLOGY.md     # 术语表
│   └── DOCUMENT_UPDATE_GUIDE.md  # 文档更新指南
│
├── docker-compose.yml      # Docker编排配置
├── deploy.sh              # 一键部署脚本
├── build-client.sh        # 前端构建脚本
├── build-server.sh        # 后端构建脚本
└── .env.docker            # 环境变量模板
```

## 核心数据模型

### 患者表 (patients)
存储患者基本信息：姓名、性别、出生日期、联系信息等

### 问诊会话表 (interview_sessions)
存储完整问诊数据：一般项目、主诉、现病史、既往史、个人史、家族史、体格检查等(JSON格式)

### 症状知识库表 (symptom_knowledge)
存储42种症状的问诊规则：必问问题、关联症状、警示征象、体格检查要点、鉴别诊断要点

### 诊断表 (diagnoses)
存储诊断信息：诊断名称、分类、关联症状、警示征象

## 开发路线图

### Phase 1: MVP ✅ 已完成
- [x] 基础问诊功能
- [x] 数据持久化 (PostgreSQL)
- [x] 症状知识库 (42种症状)
- [x] Docker 部署支持
- [x] 智能诊断建议
- [x] 症状图谱可视化

### Phase 2: 功能扩展 ✅ 已完成
- [x] 用户认证系统（Token/密码登录）
- [x] 数据统计 Dashboard

#### 用户认证系统说明

**功能特性：**
| 功能 | 说明 |
|------|------|
| 账号密码登录 | 支持用户名/密码登录，密码使用 bcrypt 加密存储 |
| Token 登录 | 开发环境支持静态 Token 快速登录（生产环境隐藏） |
| 用户注册 | 支持医生/管理员角色注册 |
| JWT 认证 | 使用 JWT Token 进行身份验证，支持自动刷新 |
| 权限控制 | 基于角色的权限管理（admin/doctor） |
| 安全防护 | 登录失败锁定、IP 限流、登录审计日志 |

**登录方式：**

1. **账号密码登录**（推荐）
   - 使用注册的用户名和密码登录
   - 登录成功后自动获取 JWT Token

2. **Token 登录**（仅开发环境）
   - 开发环境显示令牌登录选项卡
   - 支持环境变量配置的静态 Token
   - 开发环境快捷 Token: `dev-admin`

**环境标识：**
- 登录页面显示当前环境标签（开发环境/生产环境）
- 开发环境令牌登录选项带有"开发"标识
- 生产环境自动隐藏令牌登录功能

**环境变量配置：**
```bash
# JWT 密钥（生产环境必须配置）
JWT_SECRET=your-secret-key

# 静态 Token 配置（可选）
OPERATOR_TOKEN=your-static-token

# 多 Token JSON 配置（可选）
OPERATOR_TOKENS_JSON={"token1":{"operatorId":1,"role":"admin"}}
```

### Phase 3: 优化与集成 ✅ 已完成
- [x] 病历导出 Word/PDF
- [x] 移动端 UI 优化（响应式布局）

## 最近更新

### 2026年2月
- ✅ 完成 Docker 部署配置优化
- ✅ 添加生产环境部署脚本
- ✅ 统一项目文档和术语规范
- ✅ 修复前端生产构建问题
- ✅ 完善用户认证系统
  - 修复登录后 Token 存储问题
  - 添加请求拦截器自动携带 Token
  - 实现开发/生产环境差异化显示
  - 添加环境标识标签

## 常用命令

```bash
# Docker 部署
./deploy.sh           # 完整部署（推荐）
docker-compose up -d  # 启动服务
docker-compose down   # 停止服务
docker-compose logs -f # 查看日志

# 开发模式
cd client && npm run dev      # 前端开发服务器
cd server && npm run dev      # 后端开发服务器
```

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 (Frontend) | 80 | Nginx 服务 |
| 后端 API (Backend) | 4000 | Express 服务 |
| 数据库 (Database) | 5432 | PostgreSQL |
| 缓存 (Cache) | 6379 | Redis |

## 文档

- [项目术语表](./docs/TERMINOLOGY.md) - 统一术语和命名规范
- [Docker 部署指南](./DOCKER_DEPLOY.md) - Docker 部署详细说明
- [生产部署指南](./deploy/README.md) - 生产环境部署指南
- [Docker部署说明](./deploy/docker-deploy.md) - Docker部署快速参考

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

ISC License

---

**版本**: v2.0  
**最后更新**: 2026年2月
