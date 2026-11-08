FROM node:24.22.2-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM dependencies AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
FROM dependencies AS test
COPY . .
CMD ["npm","test"]
FROM node:24.22.2-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY scripts ./scripts
USER node
CMD ["node","--import","./scripts/instrumentation.mjs","scripts/start.mjs"]
