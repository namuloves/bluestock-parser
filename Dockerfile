FROM ghcr.io/puppeteer/puppeteer:24.1.0

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create user and set permissions
USER pptruser

EXPOSE 3001

CMD ["node", "server.js"]