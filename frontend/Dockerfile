# Development image: source is bind-mounted by docker-compose, so only
# dependencies are baked in.
FROM node:24-alpine
WORKDIR /app

# Run as the image's unprivileged "node" user instead of root (SEC-10).
# node_modules must be owned by it: the anonymous volume in compose is
# seeded from this layer, and Vite writes its dep cache there.
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
