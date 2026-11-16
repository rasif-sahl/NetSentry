ARG SERVER_NODE_IMAGE
FROM ${SERVER_NODE_IMAGE} AS build
WORKDIR /repo
RUN node -e "if(process.versions.node.split('.')[0]!=='24')process.exit(1)"
COPY dashboard/package*.json dashboard/
RUN npm --prefix dashboard ci --ignore-scripts --no-audit --no-fund
COPY dashboard dashboard
COPY contracts contracts
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --prefix dashboard run build && npm --prefix dashboard prune --omit=dev --ignore-scripts --no-audit --no-fund
FROM ${SERVER_NODE_IMAGE}
ENV NODE_ENV=production APP_KIND=dashboard NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /repo/dashboard/.next ./.next
COPY --from=build /repo/dashboard/public ./public
COPY --from=build /repo/dashboard/node_modules ./node_modules
COPY --from=build /repo/dashboard/package.json ./package.json
COPY infra/runtime.mjs infra/runtime-lib.mjs ./infra/
RUN mkdir -p /app/.next/cache && chown 10001:10001 /app/.next/cache
USER 10001:10001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD ["node","-e","fetch('http://127.0.0.1:3001/',{redirect:'manual'}).then(r=>process.exit(r.status<400?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["node","infra/runtime.mjs"]
