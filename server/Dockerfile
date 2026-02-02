# ============================================
# MSIA 后端服务 Dockerfile
# 医学生智能问诊辅助系统 - 服务端
# ============================================

# 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN npx prisma generate

# 编译 TypeScript
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache dumb-init postgresql-client netcat-openbsd

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package*.json ./
COPY prisma ./prisma/

# 只安装生产依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 生成 Prisma 客户端（生产环境）
RUN npx prisma generate

# 从构建阶段复制编译后的代码
COPY --from=builder /app/dist ./dist

# 复制知识库文件
COPY --from=builder /app/knowledge_base ./knowledge_base

# 复制入口脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建上传目录并设置权限
RUN mkdir -p uploads && \
    chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 4000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用 dumb-init 处理信号
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]

# 启动命令
CMD ["node", "dist/index.js"]
