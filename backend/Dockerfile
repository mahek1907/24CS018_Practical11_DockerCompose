# ==============================================================================
# Backend Dockerfile for Practical 11: Task Management API
# Node.js 18 on Alpine Linux for minimal image size and fast build
# ==============================================================================
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install only production-needed dependencies cleanly
RUN npm install

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start backend using entrypoint server.js
CMD ["node", "server.js"]
