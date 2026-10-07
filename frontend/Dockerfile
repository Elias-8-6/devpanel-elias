# Development image: source is bind-mounted by docker-compose, so only
# dependencies are baked in.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
