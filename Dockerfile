# Use official Playwright image with Node.js and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy application source
COPY . .

# Build TypeScript
RUN npm run build --workspace= || npx tsc

# Build dashboard
WORKDIR /app/src/dashboard
RUN npm ci --only=production
RUN npm run build

# Return to app root
WORKDIR /app

# Create directories for persistent data
RUN mkdir -p /var/data/reports && \
    chmod -R 777 /var/data

# Expose port (Render will set PORT env var)
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 10000) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the server
CMD ["node", "dist/server/index.js"]
