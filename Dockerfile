FROM harbor.gp.kg/library/node:22-alpine AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /src/app

# Воспроизводимая установка: только npm ci по lock-файлу, без legacy-peer-deps и tgz в репозитории.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:production

FROM harbor.gp.kg/library/nginx:alpine

RUN apk update && apk upgrade --no-cache

COPY --from=builder /src/app/dist/e-judge-selection/browser /usr/share/nginx/html
COPY ./docker/default.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid && \
    sed -i '/^user /d' /etc/nginx/nginx.conf

USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
