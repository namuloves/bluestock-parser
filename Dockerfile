FROM node:18-alpine

WORKDIR /app

# Only copy the simple server
COPY simple-server.js .

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "simple-server.js"]