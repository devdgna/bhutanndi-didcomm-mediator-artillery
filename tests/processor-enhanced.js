const { Agent, WsOutboundTransport, HttpOutboundTransport, MessagePickupModule, V2MessagePickupProtocol } = require("@credo-ts/core");
const { agentDependencies } = require("@credo-ts/node");
const { AskarModule } = require("@credo-ts/askar");
const { CheqdModule } = require("@credo-ts/cheqd");
const { ariesAskar } = require("@hyperledger/aries-askar-nodejs");
const EventEmitter = require('events');

// Load environment variables
require('dotenv').config();

// Configuration from environment variables
const CONFIG = {
  invitationUrl: process.env.INVITATION_URL,
  didMethod: process.env.DID_METHOD || 'ethr',
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://polygon-mumbai.g.alchemy.com/v2/demo',
  ethereumNetwork: process.env.ETHEREUM_NETWORK || 'polygon:mumbai',
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 15000,
  mediationTimeout: parseInt(process.env.MEDIATION_TIMEOUT) || 10000,
  pickupTimeout: parseInt(process.env.PICKUP_TIMEOUT) || 5000,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  logLevel: process.env.LOG_LEVEL || 'info',
  detailedLogging: process.env.DETAILED_LOGGING === 'true',
  performanceLogging: process.env.PERFORMANCE_LOGGING !== 'false'
};

// Validate required configuration
if (!CONFIG.invitationUrl) {
  throw new Error('INVITATION_URL environment variable is required. Please copy .env.example to .env and configure it.');
}

/**
 * Enhanced logging utility with different levels
 */
class Logger {
  constructor(walletId, level = 'info') {
    this.walletId = walletId;
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  log(level, message, data = null) {
    if (this.levels[level] <= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] ${this.walletId}:`;
      
      if (data) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  info(message, data) { this.log('info', message, data); }
  debug(message, data) { this.log('debug', message, data); }
}

/**
 * Performance metrics collector
 */
class MetricsCollector {
  constructor(walletId, events) {
    this.walletId = walletId;
    this.events = events;
    this.metrics = {
      startTime: Date.now(),
      connectionStart: null,
      connectionEnd: null,
      mediationStart: null,
      mediationEnd: null,
      pickupStart: null,
      pickupEnd: null,
      errors: []
    };
  }

  startConnection() {
    this.metrics.connectionStart = Date.now();
  }

  endConnection() {
    this.metrics.connectionEnd = Date.now();
    this.emitMetric('didcomm.connection.duration', this.getConnectionDuration());
    this.emitCounter('didcomm.connection.success');
  }

  startMediation() {
    this.metrics.mediationStart = Date.now();
  }

  endMediation() {
    this.metrics.mediationEnd = Date.now();
    this.emitMetric('didcomm.mediation.duration', this.getMediationDuration());
    this.emitCounter('didcomm.mediation.success');
  }

  startPickup() {
    this.metrics.pickupStart = Date.now();
  }

  endPickup() {
    this.metrics.pickupEnd = Date.now();
    this.emitMetric('didcomm.pickup.duration', this.getPickupDuration());
    this.emitCounter('didcomm.pickup.success');
  }

  recordError(type, error) {
    this.metrics.errors.push({ type, error: error.message, timestamp: Date.now() });
    this.emitCounter(`didcomm.${type}.failed`);
  }

  emitMetric(name, value) {
    if (this.events && CONFIG.performanceLogging) {
      this.events.emit('histogram', name, value);
    }
  }

  emitCounter(name, value = 1) {
    if (this.events && CONFIG.performanceLogging) {
      this.events.emit('counter', name, value);
    }
  }

  getConnectionDuration() {
    return this.metrics.connectionEnd - this.metrics.connectionStart;
  }

  getMediationDuration() {
    return this.metrics.mediationEnd - this.metrics.mediationStart;
  }

  getPickupDuration() {
    return this.metrics.pickupEnd - this.metrics.pickupStart;
  }

  getTotalDuration() {
    return Date.now() - this.metrics.startTime;
  }

  getSummary() {
    return {
      totalDuration: this.getTotalDuration(),
      connectionDuration: this.metrics.connectionEnd ? this.getConnectionDuration() : null,
      mediationDuration: this.metrics.mediationEnd ? this.getMediationDuration() : null,
      pickupDuration: this.metrics.pickupEnd ? this.getPickupDuration() : null,
      errorCount: this.metrics.errors.length,
      errors: this.metrics.errors
    };
  }
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = CONFIG.maxRetries, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Create timeout promise
 */
function createTimeout(ms, name) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms);
  });
}

/**
 * Initialize agent with enhanced configuration
 */
const initializeAgent = async (walletId, walletKey, logger) => {
  logger.info("Initializing agent...", { didMethod: CONFIG.didMethod });

  const agentConfig = {
    label: `load-test-agent-${walletId}`,
    walletConfig: { id: walletId, key: walletKey },
    useDidSovPrefixWhereAllowed: CONFIG.didMethod === 'sov',
  };
  
  const modules = { 
    askar: new AskarModule({ ariesAskar }),
    messagePickup: new MessagePickupModule({
      protocols: [new V2MessagePickupProtocol()]
    })
  };
  
  // Add network-specific modules
  if (CONFIG.didMethod === 'ethr') {
    modules.cheqd = new CheqdModule({
      networks: [{
        network: CONFIG.ethereumNetwork,
        rpcUrl: CONFIG.ethereumRpcUrl,
      }]
    });
  }
  
  const agent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules: modules,
  });

  agent.registerOutboundTransport(new HttpOutboundTransport());
  agent.registerOutboundTransport(new WsOutboundTransport());
  
  await agent.initialize();
  logger.info("Agent initialized successfully", { didMethod: CONFIG.didMethod });
  
  return agent;
};

/**
 * Setup agent event listeners with enhanced logging
 */
function setupEventListeners(agent, logger, metrics) {
  agent.events.on('ConnectionStateChanged', (event) => {
    const { previousState, connectionRecord } = event.payload;
    logger.debug(`Connection state: ${previousState || 'null'} -> ${connectionRecord.state}`);
    
    if (connectionRecord.state === 'completed') {
      metrics.endConnection();
    }
  });

  agent.events.on('AgentMessageSent', (event) => {
    if (CONFIG.detailedLogging) {
      logger.debug(`Message sent: ${event.payload.message['@type']}`);
    }
  });

  agent.events.on('AgentMessageReceived', (event) => {
    if (CONFIG.detailedLogging) {
      logger.debug(`Message received: ${event.payload.message['@type']}`);
    }
  });

  agent.events.on('AgentMessageProcessed', (event) => {
    if (CONFIG.detailedLogging) {
      logger.debug(`Message processed: ${event.payload.message['@type']}`);
    }
  });

  agent.events.on('AgentMessageProcessingError', (event) => {
    logger.error(`Message processing error: ${event.payload.error.message}`);
    metrics.recordError('processing', event.payload.error);
  });

  agent.events.on('OutOfBandStateChanged', (event) => {
    if (CONFIG.detailedLogging) {
      const { previousState, outOfBandRecord } = event.payload;
      logger.debug(`OOB state: ${previousState || 'null'} -> ${outOfBandRecord.state}`);
    }
  });
}

/**
 * Enhanced connection establishment with timeout and retry
 */
async function establishConnection(agent, logger, metrics) {
  logger.info("Establishing connection to mediator...");
  metrics.startConnection();

  const connectionPromise = async () => {
    const result = await agent.oob.receiveInvitationFromUrl(CONFIG.invitationUrl, { 
      autoAcceptConnection: true,
      autoAcceptInvitation: true,
      reuseConnection: false,
      handshakeProtocols: [
        'https://didcomm.org/didexchange/1.1',
        'https://didcomm.org/connections/1.0'
      ]
    });

    const { connectionRecord } = result;
    logger.info("Invitation processed", {
      connectionId: connectionRecord?.id,
      state: connectionRecord?.state
    });

    // Wait for connection completion
    return new Promise((resolve, reject) => {
      if (connectionRecord.state === 'completed') {
        resolve(connectionRecord);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection completion timeout'));
      }, CONFIG.connectionTimeout);

      const listener = (event) => {
        if (event.payload.connectionRecord.id === connectionRecord.id && 
            event.payload.connectionRecord.state === 'completed') {
          clearTimeout(timeout);
          agent.events.off('ConnectionStateChanged', listener);
          resolve(event.payload.connectionRecord);
        }
      };

      agent.events.on('ConnectionStateChanged', listener);
    });
  };

  return await retryWithBackoff(connectionPromise);
}

/**
 * Enhanced mediation request with timeout and retry
 */
async function requestMediation(agent, connectionRecord, logger, metrics) {
  logger.info("Requesting mediation...");
  metrics.startMediation();

  const mediationPromise = async () => {
    const mediationRecord = await Promise.race([
      agent.mediationRecipient.requestMediation(connectionRecord),
      createTimeout(CONFIG.mediationTimeout, 'Mediation')
    ]);

    metrics.endMediation();
    logger.info("Mediation established successfully", {
      mediationId: mediationRecord.id,
      duration: metrics.getMediationDuration()
    });

    return mediationRecord;
  };

  return await retryWithBackoff(mediationPromise);
}

/**
 * Enhanced message pickup test
 */
async function testMessagePickup(agent, mediationRecord, logger, metrics) {
  logger.info("Testing message pickup (Pickup v2)...");
  metrics.startPickup();

  try {
    const pickupPromise = async () => {
      const pickupResult = await Promise.race([
        agent.mediationRecipient.initiateMessagePickup(mediationRecord),
        createTimeout(CONFIG.pickupTimeout, 'Message pickup')
      ]);

      metrics.endPickup();
      logger.info("Message pickup completed successfully", {
        duration: metrics.getPickupDuration()
      });

      return pickupResult;
    };

    return await retryWithBackoff(pickupPromise);
  } catch (error) {
    logger.warn(`Message pickup failed: ${error.message}`);
    metrics.recordError('pickup', error);
    throw error;
  }
}

/**
 * Main connection test function
 */
async function connectToMediator(context, events, done) {
  const uniqueId = Math.random().toString(36).substring(2, 15);
  const walletId = `wallet-${uniqueId}-${Date.now()}`;
  const walletKey = `key-${uniqueId}-${Date.now()}`;
  
  const logger = new Logger(walletId, CONFIG.logLevel);
  const metrics = new MetricsCollector(walletId, events);
  
  let agent = null;

  try {
    logger.info("Starting load test", { didMethod: CONFIG.didMethod });

    // Initialize agent
    agent = await initializeAgent(walletId, walletKey, logger);
    setupEventListeners(agent, logger, metrics);

    // Establish connection
    const connectionRecord = await establishConnection(agent, logger, metrics);
    logger.info(`Connection established in ${metrics.getConnectionDuration()}ms`);

    // Request mediation
    const mediationRecord = await requestMediation(agent, connectionRecord, logger, metrics);
    logger.info(`Mediation established in ${metrics.getMediationDuration()}ms`);

    // Test message pickup
    try {
      await testMessagePickup(agent, mediationRecord, logger, metrics);
      logger.info(`Message pickup completed in ${metrics.getPickupDuration()}ms`);
    } catch (pickupError) {
      // Pickup failure is not fatal
      logger.warn("Message pickup failed but continuing", { error: pickupError.message });
    }

    // Log final metrics
    const summary = metrics.getSummary();
    logger.info("Test completed successfully", summary);

    // Emit final metrics
    metrics.emitMetric('didcomm.test.total_duration', summary.totalDuration);
    metrics.emitCounter('didcomm.test.success');

  } catch (error) {
    logger.error("Test failed", { error: error.message, stack: error.stack });
    metrics.recordError('test', error);
    metrics.emitCounter('didcomm.test.failed');
    
    if (typeof done === 'function') {
      done(error);
      return;
    } else {
      throw error;
    }
  } finally {
    // Cleanup
    if (agent) {
      try {
        logger.debug("Shutting down agent...");
        await agent.shutdown();
        logger.debug("Agent shutdown completed");
      } catch (shutdownError) {
        logger.error("Agent shutdown failed", { error: shutdownError.message });
      }
    }

    // Complete Artillery test
    if (typeof done === 'function') {
      done();
    }
  }
}

module.exports = { connectToMediator };
