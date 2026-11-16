# Pass a reviewed digest-pinned Node 24 image; no floating default is supplied.
ARG SERVER_NODE_IMAGE
FROM ${SERVER_NODE_IMAGE} AS build
WORKDIR /repo
COPY backend/package*.json backend/
RUN npm --prefix backend ci --ignore-scripts --no-audit --no-fund
COPY backend backend
COPY contracts contracts
RUN npm --prefix backend run build && npm --prefix backend prune --omit=dev --ignore-scripts --no-audit --no-fund
FROM ${SERVER_NODE_IMAGE}
ENV NODE_ENV=production APP_KIND=backend PORT=3000
WORKDIR /app
COPY --from=build /repo/backend/dist ./dist
COPY --from=build /repo/backend/node_modules ./node_modules
COPY --from=build /repo/backend/package.json ./package.json
COPY infra/runtime.mjs ./infra/runtime.mjs
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD ["node","-e","fetch('http://127.0.0.1:3000/'+(process.env.API_PREFIX||'api')+'/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["node","infra/runtime.mjs"]
