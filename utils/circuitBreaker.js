/**
 * Circuit Breaker for Domain Policies
 * Prevents repeated failures from overwhelming the system
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 120000; // 2 minutes
    this.halfOpenAttempts = options.halfOpenAttempts || 2;

    // Circuit states
    this.STATES = {
      CLOSED: 'closed',      // Normal operation
      OPEN: 'open',          // Blocking all requests
      HALF_OPEN: 'half-open' // Testing if service recovered
    };

    // Per-domain circuit state
    this.circuits = new Map();

    // Global metrics
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      circuitsOpened: 0,
      circuitsClosed: 0
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(domain, fn, options = {}) {
    this.metrics.totalRequests++;

    const circuit = this.getOrCreateCircuit(domain);

    // Check circuit state
    const state = this.getState(circuit);

    if (state === this.STATES.OPEN) {
      // Check if should transition to half-open
      if (Date.now() - circuit.openedAt > this.resetTimeout) {
        this.transitionToHalfOpen(circuit);
      } else {
        this.metrics.blockedRequests++;
        throw new CircuitBreakerError(
          `Circuit breaker OPEN for ${domain}. Too many failures.`,
          domain,
          state
        );
      }
    }

    // Try to execute the function
    try {
      const result = await this.executeWithTimeout(fn, options.timeout);

      // Success - update circuit
      this.recordSuccess(circuit);

      return result;

    } catch (error) {
      // Failure - update circuit
      this.recordFailure(circuit, error);

      // Check if should open circuit
      if (this.shouldOpenCircuit(circuit)) {
        this.openCircuit(circuit, domain);
      }

      throw error;
    }
  }

  /**
   * Get or create circuit for domain
   */
  getOrCreateCircuit(domain) {
    if (!this.circuits.has(domain)) {
      this.circuits.set(domain, {
        domain,
        state: this.STATES.CLOSED,
        failures: 0,
        successes: 0,
        lastFailure: null,
        openedAt: null,
        halfOpenAttempts: 0,
        history: [],
        errorTypes: {}
      });
    }

    return this.circuits.get(domain);
  }

  /**
   * Get current state of circuit
   */
  getState(circuit) {
    // Auto-transition from OPEN to HALF_OPEN after timeout
    if (circuit.state === this.STATES.OPEN) {
      if (Date.now() - circuit.openedAt > this.resetTimeout) {
        return this.STATES.HALF_OPEN;
      }
    }

    return circuit.state;
  }

  /**
   * Record successful execution
   */
  recordSuccess(circuit) {
    this.metrics.successfulRequests++;

    circuit.successes++;
    circuit.failures = 0; // Reset failure count on success

    // Add to history
    this.addToHistory(circuit, { success: true, timestamp: Date.now() });

    // Handle state transitions
    if (circuit.state === this.STATES.HALF_OPEN) {
      circuit.halfOpenAttempts++;

      if (circuit.halfOpenAttempts >= this.halfOpenAttempts) {
        // Enough successful attempts, close circuit
        this.closeCircuit(circuit);
      }
    }
  }

  /**
   * Record failed execution
   */
  recordFailure(circuit, error) {
    this.metrics.failedRequests++;

    circuit.failures++;
    circuit.lastFailure = {
      error: error.message,
      timestamp: Date.now()
    };

    // Track error types
    const errorType = error.constructor.name;
    circuit.errorTypes[errorType] = (circuit.errorTypes[errorType] || 0) + 1;

    // Add to history
    this.addToHistory(circuit, {
      success: false,
      error: error.message,
      timestamp: Date.now()
    });

    // If in half-open state, immediately open circuit again
    if (circuit.state === this.STATES.HALF_OPEN) {
      this.openCircuit(circuit, circuit.domain);
    }
  }

  /**
   * Check if circuit should be opened
   */
  shouldOpenCircuit(circuit) {
    if (circuit.state === this.STATES.OPEN) return false;

    // Check failure threshold
    if (circuit.failures >= this.failureThreshold) {
      // Check if failures happened within monitoring period
      const recentFailures = circuit.history.filter(
        h => !h.success && (Date.now() - h.timestamp < this.monitoringPeriod)
      ).length;

      return recentFailures >= this.failureThreshold;
    }

    return false;
  }

  /**
   * Open the circuit
   */
  openCircuit(circuit, domain) {
    circuit.state = this.STATES.OPEN;
    circuit.openedAt = Date.now();
    circuit.halfOpenAttempts = 0;

    this.metrics.circuitsOpened++;

    console.log(`🔴 Circuit breaker OPENED for ${domain} after ${circuit.failures} failures`);
  }

  /**
   * Close the circuit
   */
  closeCircuit(circuit) {
    const wasOpen = circuit.state === this.STATES.OPEN || circuit.state === this.STATES.HALF_OPEN;

    circuit.state = this.STATES.CLOSED;
    circuit.failures = 0;
    circuit.halfOpenAttempts = 0;
    circuit.openedAt = null;

    if (wasOpen) {
      this.metrics.circuitsClosed++;
      console.log(`🟢 Circuit breaker CLOSED for ${circuit.domain} - recovered`);
    }
  }

  /**
   * Transition to half-open state
   */
  transitionToHalfOpen(circuit) {
    circuit.state = this.STATES.HALF_OPEN;
    circuit.halfOpenAttempts = 0;

    console.log(`🟡 Circuit breaker HALF-OPEN for ${circuit.domain} - testing recovery`);
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout = 30000) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  /**
   * Add event to circuit history
   */
  addToHistory(circuit, event) {
    circuit.history.push(event);

    // Keep only last 100 events
    if (circuit.history.length > 100) {
      circuit.history.shift();
    }
  }

  /**
   * Get circuit status for a domain
   */
  getStatus(domain) {
    const circuit = this.circuits.get(domain);

    if (!circuit) {
      return {
        domain,
        state: this.STATES.CLOSED,
        message: 'No circuit breaker active'
      };
    }

    const state = this.getState(circuit);

    return {
      domain,
      state,
      failures: circuit.failures,
      successes: circuit.successes,
      lastFailure: circuit.lastFailure,
      openedAt: circuit.openedAt,
      willResetAt: circuit.openedAt ? new Date(circuit.openedAt + this.resetTimeout) : null,
      errorTypes: circuit.errorTypes,
      recentHistory: circuit.history.slice(-10)
    };
  }

  /**
   * Get all circuit statuses
   */
  getAllStatuses() {
    const statuses = {};

    for (const [domain, circuit] of this.circuits) {
      statuses[domain] = this.getStatus(domain);
    }

    return statuses;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const openCircuits = Array.from(this.circuits.values())
      .filter(c => this.getState(c) === this.STATES.OPEN);

    const halfOpenCircuits = Array.from(this.circuits.values())
      .filter(c => this.getState(c) === this.STATES.HALF_OPEN);

    return {
      ...this.metrics,
      openCircuits: openCircuits.map(c => c.domain),
      halfOpenCircuits: halfOpenCircuits.map(c => c.domain),
      totalCircuits: this.circuits.size,
      successRate: this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      blockRate: this.metrics.totalRequests > 0
        ? (this.metrics.blockedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset a specific circuit
   */
  reset(domain) {
    if (this.circuits.has(domain)) {
      const circuit = this.circuits.get(domain);
      this.closeCircuit(circuit);
      circuit.history = [];
      circuit.errorTypes = {};
      console.log(`🔄 Circuit breaker reset for ${domain}`);
      return true;
    }
    return false;
  }

  /**
   * Reset all circuits
   */
  resetAll() {
    for (const circuit of this.circuits.values()) {
      this.closeCircuit(circuit);
    }
    this.circuits.clear();
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * Check if circuit is open
   */
  isOpen(domain) {
    const circuit = this.circuits.get(domain);
    return circuit ? this.getState(circuit) === this.STATES.OPEN : false;
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(domain) {
    const circuit = this.circuits.get(domain);
    return !circuit || this.getState(circuit) === this.STATES.CLOSED;
  }
}

/**
 * Custom error for circuit breaker
 */
class CircuitBreakerError extends Error {
  constructor(message, domain, state) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.domain = domain;
    this.state = state;
  }
}

// Singleton instance
let circuitBreaker = null;

module.exports = {
  getCircuitBreaker: (options) => {
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(options);
    }
    return circuitBreaker;
  },
  CircuitBreaker,
  CircuitBreakerError
};