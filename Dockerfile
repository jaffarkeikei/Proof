# Multi-stage build for Node.js backend + Next.js frontend

# Stage 1: Backend dependencies
FROM node:18-alpine AS backend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Frontend build
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# Stage 3: Production image
FROM node:18-alpine AS production
WORKDIR /app

# Install production dependencies
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy backend source
COPY src/ ./src/

# Copy frontend build
COPY --from=frontend-build /app/frontend/.next ./app/.next
COPY --from=frontend-build /app/frontend/public ./app/public
COPY app/package*.json ./app/

# Create storage directories
RUN mkdir -p storage/videos storage/audio logs

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start both backend and frontend
CMD ["sh", "-c", "node src/server.js & cd app && npm start"]
