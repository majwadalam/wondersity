# Wondersity: a production image for Coolify (or any Docker host).
#
# Build:  docker build -t wondersity \
#           --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
#           --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
#           --build-arg NEXT_PUBLIC_SITE_URL=https://wondersity.com .
# Run:    docker run -p 3000:3000 --env-file .env.production wondersity
#
# NEXT_PUBLIC_* values are baked into the build (Next.js inlines them), so they
# must be build arguments; in Coolify, tick "Build Variable" for each. Every
# other variable (OPENROUTER_API_KEY, SUPABASE_SECRET_KEY, PADDLE_*, models) is
# read at runtime and is only needed when the container starts. See
# .env.example for the full list.
#
# Lessons run as background jobs inside the server process (lib/jobs.ts,
# Next.js `after`), so run one long-lived container, not a serverless function.

ARG NODE_IMAGE=node:24-bookworm-slim

# ---- dependencies --------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ---------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PADDLE_ENV
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ARG NEXT_PUBLIC_PADDLE_PRICE_MONTHLY
ARG NEXT_PUBLIC_PADDLE_PRICE_YEARLY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV \
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
    NEXT_PUBLIC_PADDLE_PRICE_MONTHLY=$NEXT_PUBLIC_PADDLE_PRICE_MONTHLY \
    NEXT_PUBLIC_PADDLE_PRICE_YEARLY=$NEXT_PUBLIC_PADDLE_PRICE_YEARLY \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- runtime -------------------------------------------------------------
FROM ${NODE_IMAGE} AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# The standalone server (with only the node_modules it needs, sharp included),
# plus the static assets and public files it serves.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Checks the landing page, not /api/health: that reports the AI provider's
# credit too, and an empty account shouldn't get the container restarted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
