# AEHOP API — production image.
# Single-stage for reliability; optimize to multi-stage later if image size matters.
FROM node:22-alpine

WORKDIR /app

# Install dependencies (including Prisma CLI for migrate deploy at boot)
COPY package*.json ./
RUN npm ci

# Build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3001

# Apply pending migrations, then start. DATABASE_URL points at Supabase in prod.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
