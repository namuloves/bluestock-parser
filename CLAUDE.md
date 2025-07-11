# Bluestock Parser Project Instructions

## Project Context
This is a **separate parser microservice** for the main Bluestock application. The parser was extracted into its own folder (`bluestock-parser`) to be deployed independently on Railway.

## Main Project Structure
- **Main App**: `/Users/namu_1/bluestock` - Next.js application with product listings
- **Parser Service**: `/Users/namu_1/bluestock-parser` - Express.js API for scraping product data

## Parser Service Purpose
The parser service handles web scraping of product data from various e-commerce sites and provides a clean API for the main Bluestock application to consume.

## Key Files to Reference
- `src/app/components/ProductGrid.tsx` - Main product display component
- Recent commits show work on Shopify integration and product fetching

## Instructions for New Claude Code Instance

### 1. Initial Setup
```bash
cd /Users/namu_1/bluestock-parser
npm init -y
npm install express cors
```

### 2. Required Files to Create
- `server.js` - Main Express server
- `scrapers/` directory - Contains scraping logic
- `package.json` - Should include Railway deployment scripts

### 3. Key Features to Implement
- Express API endpoints for product scraping
- CORS configuration for main app integration
- Error handling and timeout management
- Railway deployment configuration

### 4. Deployment Target
- Platform: Railway
- Environment: Production-ready Express server
- Purpose: Standalone parsing service for the main Bluestock app

### 5. Integration Points
The parser service will be consumed by the main Bluestock application's product fetching logic.

## Development Commands
```bash
# Start development server
npm run dev

# Deploy to Railway
npm run deploy
```

## Important Notes
- This is a **microservice architecture** - keep parser logic separate from main app
- Focus on API design and reliability
- Ensure proper error handling for web scraping operations