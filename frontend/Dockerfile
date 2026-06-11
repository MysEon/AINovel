# ── AINovel Frontend ──
# 多阶段构建：node builder → nginx runtime

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx 配置：SPA 路由 fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
