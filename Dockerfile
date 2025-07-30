FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Railway needs specific port binding
ENV PORT=3001
EXPOSE 3001

# Start directly with node
CMD ["node", "server.js"]