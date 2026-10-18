# ==============================================================================
# Multi-stage Frontend Dockerfile for Practical 11: React + Vite
# Stage 1: Build static assets using Node.js 18
# Stage 2: Serve optimized assets with Nginx Alpine (Extremely small, production-grade)
# ==============================================================================

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the production bundle into /app/dist
RUN npm run build

# Stage 2: Production serving stage
FROM nginx:alpine

# Copy custom Nginx configuration listening on port 5173
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose frontend port
EXPOSE 5173

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
