# 医学生智能问诊辅助系统 (MSIA)

[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

> MedStudent Interview Assistant - 基于 Web 的智能引导式问诊辅助工具

## 项目简介

医学生智能问诊辅助系统（MSIA）是为医学生和初级临床医生开发的智能问诊工具。系统通过结构化问诊清单、症状知识库和智能提示，帮助用户系统性地完成病史采集，避免遗漏关键信息，提高问诊效率和病历书写质量。

### 核心价值

- **教学价值**：帮助医学生建立系统化问诊思维
- **临床价值**：减少信息遗漏，提高病史采集完整性
- **效率价值**：结构化数据输入，自动生成病历草稿

## 功能特性

### 已实现功能 ✅

- **智能导航与进度管理** - 侧边栏导航显示问诊结构树，实时显示各模块完成状态
- **患者信息管理** - 基本信息录入、自动年龄计算、数据可靠性评估
- **主诉智能解析** - 主诉文本输入、结构化展示、关键词提取
- **现病史动态问诊引擎** - 42种症状知识库、动态问题生成、HPI结构化录入
- **完整病史采集** - 既往史、个人史、婚育史/月经史、家族史、系统回顾
- **体格检查记录** - 一般情况检查、专科检查录入、辅助检查记录
- **智能诊断辅助** - 智能诊断建议、症状关联图谱、鉴别诊断要点
- **医学知识库** - 集成智能助手、知识面板展示
- **数据管理** - 问诊会话列表、患者列表管理、数据持久化存储

### 技术栈

**前端**
- React 19 + TypeScript 5
- Vite 7 构建工具
- Ant Design 6 UI组件库
- Zustand 状态管理
- Axios + React Query 网络请求
- Vitest 测试框架

**后端**
- Node.js + Express 5
- TypeScript 5
- Prisma 7 ORM
- PostgreSQL 16 数据库

**部署**
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
cd 医学生智能问诊辅助系统（MSIA）

# 2. 配置环境变量
cp .env.docker .env

# 3. 使用 Makefile 一键部署
make deploy

# 4. 访问应用
# 前端: http://localhost
# API: http://localhost:4000
```

### 手动部署

**后端服务**
```bash
cd server
npm install
npx prisma migrate deploy
npm run build
npm start
```

**前端应用**
```bash
cd client
npm install
npm run dev
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
├── scripts/                # 部署脚本
├── docker-compose.yml      # Docker编排配置
├── Makefile               # 快捷命令
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

### Phase 2: 智能增强 🔄 进行中
- [x] 智能诊断建议
- [x] 症状图谱可视化
- [ ] 医学指南定期更新功能
- [ ] 诊断准确率优化

### Phase 3: 扩展与优化 ⏳ 计划中
- [ ] 用户认证系统
- [ ] 数据统计 Dashboard
- [ ] 移动端 UI 优化
- [ ] 病历导出 Word/PDF

## 最近更新

### 2026年2月
- ✅ 完成 Docker 部署配置
- ✅ 添加智能诊断功能
- ✅ 实现症状关联图谱
- ✅ 项目目录清理优化
- 🔄 开发医学指南定期更新功能

## 常用命令

```bash
# Docker 部署
make deploy          # 完整部署
make up              # 启动服务
make down            # 停止服务
make logs            # 查看日志
make backup          # 备份数据库

# 开发模式
make dev             # 开发环境启动

# 手动开发
cd client && npm run dev      # 前端开发服务器
cd server && npm run dev      # 后端开发服务器
```

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 80 | Nginx 服务 |
| 后端 API | 4000 | Express 服务 |
| 数据库 | 5432 | PostgreSQL |

## 文档

- [项目开发文档](./医学生智能问诊辅助系统%20-%20项目开发文档) - 详细功能规格和技术架构
- [Docker 部署指南](./DOCKER_DEPLOY.md) - Docker 部署详细说明
- [部署文档](./deploy/docker-deploy.md) - 生产环境部署指南

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

ISC License

---

**版本**: v2.0  
**最后更新**: 2026年2月
