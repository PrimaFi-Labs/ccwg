FROM node:22-alpine

RUN corepack enable

WORKDIR /app

# 1. Copy workspace root config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# 2. Copy every workspace member's package.json (pnpm needs them all for resolution)
COPY packages/shared/package.json ./packages/shared/
COPY ccwg-server/package.json     ./ccwg-server/
COPY ccwg-web/package.json        ./ccwg-web/

# 3. Install only ccwg-server + its workspace deps (@ccwg/shared)
RUN pnpm install --filter ccwg-server...

# 4. Copy source for shared package (exports raw .ts, needed at runtime by tsx)
COPY packages/shared/ ./packages/shared/

# 5. Copy server source
COPY ccwg-server/ ./ccwg-server/

EXPOSE 3001

CMD ["pnpm", "--filter", "ccwg-server", "start"]
