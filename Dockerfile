FROM node:24-alpine
LABEL pl.dag.component="devgui"
WORKDIR /app
COPY package*.json ./
# Use npm ci when a lockfile is available. Exact direct versions are in package.json.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
RUN npm test && npm run build && chown -R node:node /app
USER node
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD ["node", "scripts/healthcheck.mjs"]
CMD ["npm", "run", "dev"]
