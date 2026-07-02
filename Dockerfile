FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` for reproducible builds from the committed lockfile (npm install can
# mutate it). (Audit finding.)
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
# Run as the image's built-in non-root user (smaller blast radius). (Audit.)
USER node
# The app binds 3005 (`next start -p 3005`), not 3000 — expose the real port so
# `docker run -p 3005:3005` works out of the box. (Audit finding.)
EXPOSE 3005
CMD ["npm", "start"]
