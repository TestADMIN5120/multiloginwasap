# --- runtime image (single-stage, alpine) ---
FROM node:20-alpine AS runtime

# wget is used by the docker HEALTHCHECK; tini is a tiny init that
# forwards SIGTERM/SIGINT to node so `docker stop` shuts down cleanly.
RUN apk add --no-cache wget tini

# Run as a non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# install deps first (better layer caching)
COPY --chown=app:app package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# copy source
COPY --chown=app:app src ./src

# uploads directory (mounted as a named volume by docker-compose)
RUN mkdir -p /app/uploads && chown -R app:app /app/uploads

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

USER app

# Container-side healthcheck so docker / orchestrators know when the API is live.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]

