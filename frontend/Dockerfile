# Production image for the project website: builds and prerenders the landing page, then serves it with nginx.
# Railway passes service variables as build args, so set SITE_URL there to get the canonical URL and sitemap.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
ARG SITE_URL
RUN SITE_URL="$SITE_URL" npm run build

FROM nginx:1.27-alpine
# nginx renders templates/*.template with envsubst at start, so the server listens on Railway's $PORT.
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
