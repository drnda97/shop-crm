# ShopCRM: panel, API i prodavnica u jednoj slici. Baza je odvojen servis (docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# mysqldump za `npm run backup`
RUN apk add --no-cache mariadb-client
COPY --from=build /app ./
# Slike ubačene iz panela i rezervne kopije žive van slike, na disku domaćina.
RUN mkdir -p storage backups && chown -R node:node storage backups
USER node
VOLUME ["/app/storage", "/app/backups"]
EXPOSE 3000
CMD ["npm", "start"]
