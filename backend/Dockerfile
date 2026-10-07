# Development image: source is bind-mounted by docker-compose, so only
# dependencies are baked in.
FROM node:24-alpine
WORKDIR /app

# Run as the image's unprivileged "node" user instead of root (SEC-10).
# node_modules and dist must be owned by it: the anonymous volumes in compose
# are seeded from this image, and watch mode writes its output to dist.
RUN chown node:node /app
USER node
RUN mkdir dist

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
EXPOSE 3000
# dist is a volume mount point (see docker-compose.yml) and can't be deleted,
# so the Docker config keeps deleteOutDir off.
CMD ["npm", "run", "start:dev", "--", "--config", "nest-cli.docker.json"]
