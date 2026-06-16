FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json

RUN npm install --workspaces

COPY shared ./shared
COPY server ./server

RUN cd shared && npm run build
RUN cd server && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json

RUN npm install --workspaces --production

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
