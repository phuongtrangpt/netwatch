# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:20-alpine
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Frontend/build tools run on the Windows Docker VM architecture.
# SQLite is external to the server bundle, so no native build is needed here.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json package-lock.json ./
# This stage runs for each TARGETPLATFORM. Never copy host node_modules.
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
RUN apk add --no-cache tini su-exec libstdc++ && mkdir /data && chown node:node /data
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./
COPY scripts/start.mjs scripts/import-cloud.mjs ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/netwatch-entrypoint
RUN chmod 755 /usr/local/bin/netwatch-entrypoint
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=4s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz',{signal:AbortSignal.timeout(2500)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Entrypoint only initializes volume ownership, then drops to uid/gid 1000.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/netwatch-entrypoint"]
CMD ["node", "scripts/start.mjs"]
