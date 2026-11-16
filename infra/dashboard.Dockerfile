ARG SERVER_NODE_IMAGE
FROM ${SERVER_NODE_IMAGE} AS build
WORKDIR /repo
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
COPY infra/runtime.mjs ./infra/runtime.mjs
USER 10001:10001
EXPOSE 3001
ENTRYPOINT ["node","infra/runtime.mjs"]
