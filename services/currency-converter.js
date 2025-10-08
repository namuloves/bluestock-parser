/**
 * Currency Converter Service
 * Handles currency conversion with caching to minimize API calls
 */

const axios = require('axios');

class CurrencyConverter {
  constructor() {
    this.rates = {};
    this.lastUpdate = null;
    this.UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    this.BASE_CURRENCY = 'USD';

    // Free API endpoint (no key required for basic usage)
    this.API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

    // Fallback static rates (updated manually) in case API fails
    this.fallbackRates = {
      'USD': 1.0,
      'EUR': 0.92,
      'GBP': 0.79,
      'DKK': 6.88,
      'SEK': 10.89,
      'NOK': 10.98,
      'CHF': 0.91,
      'CAD': 1.36,
      'AUD': 1.54,
      'NZD': 1.66,
      'JPY': 149.50,
      'CNY': 7.29,
      'KRW': 1341.25,
      'SGD': 1.35,
      'HKD': 7.81,
      'INR': 83.12
    };

    // Initialize with fallback rates
    this.rates = { ...this.fallbackRates };
  }

  /**
   * Check if rates need updating
   */
  needsUpdate() {
    if (!this.lastUpdate) return true;
    return Date.now() - this.lastUpdate > this.UPDATE_INTERVAL;
  }

  /**
   * Update exchange rates from API
   */
  async updateRates() {
    try {
      console.log('💱 Updating exchange rates...');

      const response = await axios.get(this.API_URL, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Bluestock Parser/1.0'
        }
      });

      if (response.data && response.data.rates) {
        this.rates = response.data.rates;
        this.lastUpdate = Date.now();
        console.log('✅ Exchange rates updated successfully');
        console.log(`📊 Loaded rates for ${Object.keys(this.rates).length} currencies`);
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to update exchange rates:', error.message);
      console.log('⚠️ Using fallback exchange rates');
      // Keep using existing/fallback rates
    }
    return false;
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(amount, from, to = 'USD') {
    // Same currency, no conversion needed
    if (from === to) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: to,
        rate: 1,
        timestamp: new Date().toISOString()
      };
    }

    // Update rates if needed
    if (this.needsUpdate()) {
      await this.updateRates();
    }

    // Get conversion rate
    const rate = await this.getRate(from, to);

    // Perform conversion
    const convertedAmount = amount * rate;

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
      targetCurrency: to,
      rate: rate,
      timestamp: new Date().toISOString(),
      ratesUpdated: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : 'fallback'
    };
  }

  /**
   * Get exchange rate between two currencies
   */
  async getRate(from, to = 'USD') {
    // Update rates if needed
    if (this.needsUpdate()) {
      await this.updateRates();
    }

    // Direct conversion to/from USD
    if (from === 'USD') {
      return this.rates[to] || 1;
    }
    if (to === 'USD') {
      return 1 / (this.rates[from] || 1);
    }

    // Cross-rate calculation (from -> USD -> to)
    const fromRate = this.rates[from] || 1;
    const toRate = this.rates[to] || 1;

    return toRate / fromRate;
  }

  /**
   * Get current rates for display/debugging
   */
  getCurrentRates() {
    return {
      rates: this.rates,
      lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : 'never',
      isUsingFallback: !this.lastUpdate
    };
  }

  /**
   * Format currency value with proper symbol
   */
  formatCurrency(amount, currency) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'DKK': 'kr',
      'SEK': 'kr',
      'NOK': 'kr',
      'CHF': 'Fr',
      'CAD': 'C$',
      'AUD': 'A$',
      'NZD': 'NZ$',
      'JPY': '¥',
      'CNY': '¥',
      'KRW': '₩',
      'SGD': 'S$',
      'HKD': 'HK$',
      'INR': '₹'
    };

    const symbol = symbols[currency] || currency;

    // Format based on currency conventions
    if (['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD'].includes(currency)) {
      // Symbol before: $100.00
      return `${symbol}${amount.toFixed(2)}`;
    } else if (['EUR'].includes(currency)) {
      // Symbol after with space: 100,00 €
      return `${amount.toFixed(2).replace('.', ',')} ${symbol}`;
    } else if (['DKK', 'SEK', 'NOK'].includes(currency)) {
      // Amount with kr: 1.095 kr
      const formatted = amount.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return `${formatted} ${symbol}`;
    } else if (currency === 'GBP') {
      // Symbol before: £100.00
      return `${symbol}${amount.toFixed(2)}`;
    } else if (currency === 'JPY' || currency === 'KRW') {
      // No decimals for these
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    } else {
      // Default format
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  /**
   * Batch convert multiple prices
   */
  async batchConvert(prices, from, to = 'USD') {
    const rate = await this.getRate(from, to);

    return prices.map(price => ({
      original: price,
      converted: Math.round(price * rate * 100) / 100,
      rate: rate
    }));
  }
}

// Singleton instance
let converterInstance = null;

function getCurrencyConverter() {
  if (!converterInstance) {
    converterInstance = new CurrencyConverter();
    // Initialize rates on first load
    converterInstance.updateRates().catch(console.error);
  }
  return converterInstance;
}

module.exports = {
  CurrencyConverter,
  getCurrencyConverter
};