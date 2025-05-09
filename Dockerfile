# Dockerfile

# --- Stage 1: Build ---
FROM node:24-alpine AS builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code into the image
COPY . .

# Transpile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# --- Stage 2: Production ---
FROM node:24-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

WORKDIR /usr/src/app

# Copy only the necessary artifacts from the builder stage
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Add script to wait for database
RUN echo '#!/bin/sh' > /usr/src/app/start.sh && \
    echo 'echo "Waiting for MongoDB to be ready..."' >> /usr/src/app/start.sh && \
    echo 'sleep 5' >> /usr/src/app/start.sh && \
    echo 'node dist/server.js' >> /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Expose the port the app runs on
EXPOSE ${PORT}

# Command to run your application
CMD ["/bin/sh", "/usr/src/app/start.sh"]
