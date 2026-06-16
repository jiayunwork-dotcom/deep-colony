FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY shared/package.json ./shared/package.json
COPY client/package.json ./client/package.json

RUN npm install --workspaces

COPY shared ./shared
COPY client ./client

RUN cd shared && npm run build
RUN cd client && npm run build

FROM nginx:alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
