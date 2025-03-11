# Use a multi-stage build for optimized container size
FROM node:20-slim as build

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install ALL dependencies including dev dependencies for build
RUN npm ci

# Copy source code
COPY . .

# Fix TypeScript errors
COPY tsconfig.json ./
COPY tsconfig.node.json ./

# Build the application
RUN npm run build

# Second stage: production image
FROM node:20-slim as production

# Set environment variables
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Create cache directories
RUN mkdir -p /app/cache/processed_images /app/cache/split_images

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/public ./public
COPY --from=build /app/cache/*.json ./cache/

# Expose the port
EXPOSE 8080

# Set the command to run the server
CMD ["node", "server.js"]