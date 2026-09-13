# ==============================================================================
# Dockerfile: X AI Automation Lead Finder Backend
# Base Image: Official Microsoft Playwright with Ubuntu Jammy & Chromium deps
# ==============================================================================
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# Set application working directory
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Clean install of all dependencies matching package-lock.json
RUN npm ci

# Copy application source code, configuration, and assets
COPY . .

# Set container environment variables
ENV PORT=10000
ENV NODE_ENV=production

# Expose the application listening port
EXPOSE 10000

# Start Node.js server
CMD ["npm", "start"]
