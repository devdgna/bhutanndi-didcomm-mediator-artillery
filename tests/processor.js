const { Agent, WsOutboundTransport, HttpOutboundTransport, MessagePickupModule, V2MessagePickupProtocol } = require("@credo-ts/core");
const { agentDependencies } = require("@credo-ts/node");
const { AskarModule } = require("@credo-ts/askar");
const { CheqdModule } = require("@credo-ts/cheqd");
const { ariesAskar } = require("@hyperledger/aries-askar-nodejs");

// Load environment variables from .env file
require('dotenv').config();

// Get invitation URL from environment variable
const invitationUrl = process.env.INVITATION_URL;
if (!invitationUrl) {
  throw new Error('INVITATION_URL environment variable is required. Please copy .env.example to .env and configure it.');
}

// Environment variable to control DID method (did:ethr, did:key, or did:sov)
const DID_METHOD = process.env.DID_METHOD || 'ethr';

// Polygon Mumbai testnet RPC (free tier)
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://polygon-mumbai.g.alchemy.com/v2/demo';
const ETHEREUM_NETWORK = process.env.ETHEREUM_NETWORK || 'polygon:mumbai';

const initializeAgent = async (walletId, walletKey) => {
  // Create agent configuration based on DID method
  const agentConfig = {
    label: "load-test-agent-" + walletId,
    walletConfig: { id: walletId, key: walletKey },
    useDidSovPrefixWhereAllowed: DID_METHOD === 'sov',
  };
  
  // Configure modules based on DID method
  const modules = { 
    askar: new AskarModule({ ariesAskar }),
    messagePickup: new MessagePickupModule({
      protocols: [new V2MessagePickupProtocol()]  // Explicitly use only Pickup v2
    })
  };
  
  // Add Cheqd module for did:ethr support (works with Polygon too)
  if (DID_METHOD === 'ethr') {
    modules.cheqd = new CheqdModule({
      networks: [{
        network: ETHEREUM_NETWORK,
        rpcUrl: ETHEREUM_RPC_URL,
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
  
  // Log which DID method is being used
  console.log(walletId + " initialized with DID method: " + DID_METHOD);
  
  return agent;
};

async function connectToMediator(context, events, done) {
  const uniqueId = Math.random().toString(36).substring(2, 15);
  const walletId = "wallet-" + uniqueId + "-" + Date.now();
  const walletKey = "key-" + uniqueId + "-" + Date.now();
  
  try {
    console.log("Initializing agent " + walletId + "...");
    const agent = await initializeAgent(walletId, walletKey);

    // Set up promise to wait for connection completion
    let connectionCompletedResolve;
    const connectionCompletedPromise = new Promise((resolve) => {
      connectionCompletedResolve = resolve;
    });

    agent.events.on('ConnectionStateChanged', (event) => {
      console.log(walletId + " connection: " + (event.payload.previousState || 'null') + " -> " + event.payload.connectionRecord.state);
      if (event.payload.connectionRecord.state === 'completed') {
        connectionCompletedResolve(event.payload.connectionRecord);
      }
    });

    agent.events.on('AgentMessageSent', (event) => {
      console.log(walletId + " sent: " + event.payload.message['@type']);
    });

    agent.events.on('AgentMessageReceived', (event) => {
      console.log(walletId + " received: " + event.payload.message['@type']);
    });

    // Add more detailed logging and error handlers
    agent.events.on('AgentMessageProcessed', (event) => {
      console.log(walletId + " processed: " + event.payload.message['@type']);
    });

    agent.events.on('AgentMessageProcessingError', (event) => {
      console.log(walletId + " processing error: " + event.payload.error.message);
    });

    agent.events.on('OutOfBandStateChanged', (event) => {
      console.log(walletId + " OOB state: " + (event.payload.previousState || 'null') + " -> " + event.payload.outOfBandRecord.state);
    });

    console.log("Connecting " + walletId + " to mediator...");
    const connectionStartTime = Date.now();
    
    const result = await agent.oob.receiveInvitationFromUrl(invitationUrl, { 
      autoAcceptConnection: true,
      autoAcceptInvitation: true,
      reuseConnection: false,
      handshakeProtocols: [
        'https://didcomm.org/didexchange/1.1',
        'https://didcomm.org/connections/1.0'
      ]
    });

    const { connectionRecord } = result;
    console.log(walletId + " processed invitation");
    console.log("   Connection ID: " + (connectionRecord ? connectionRecord.id : 'none'));
    console.log("   Connection State: " + (connectionRecord ? connectionRecord.state : 'none'));
    console.log("   DID Method: " + DID_METHOD);
    
    console.log("Waiting for connection to complete...");
    
    // Race between connection completion and timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(null), 10000); // 10 second timeout
    });
    
    const completedConnection = await Promise.race([connectionCompletedPromise, timeoutPromise]);
    
    if (completedConnection) {
      const connectionDuration = Date.now() - connectionStartTime;
      console.log(walletId + " connection completed in " + connectionDuration + "ms!");
      
      // Emit Artillery metrics for connection timing
      if (events) {
        events.emit('histogram', 'didcomm.connection.duration', connectionDuration);
        events.emit('counter', 'didcomm.connection.success', 1);
      }
      
      try {
        console.log(walletId + " requesting mediation...");
        const mediationStartTime = Date.now();
        const mediationRecord = await agent.mediationRecipient.requestMediation(completedConnection);
        const mediationDuration = Date.now() - mediationStartTime;
        
        console.log(walletId + " mediation SUCCESS! ID: " + mediationRecord.id + " (took " + mediationDuration + "ms)");
        
        // Emit Artillery metrics for mediation timing
        if (events) {
          events.emit('histogram', 'didcomm.mediation.duration', mediationDuration);
          events.emit('counter', 'didcomm.mediation.success', 1);
        }
        
        // Test message pickup functionality with Pickup v2
        try {
          console.log(walletId + " testing message pickup (Pickup v2)...");
          const pickupStartTime = Date.now();
          
          // Check what pickup protocols are supported
          console.log(walletId + " pickup module registered: " + (agent.messagePickup ? 'yes' : 'no'));
          
          // Try to initiate message pickup (should use Pickup v2)
          const pickupResult = await agent.mediationRecipient.initiateMessagePickup(mediationRecord);
          const pickupDuration = Date.now() - pickupStartTime;
          
          console.log(walletId + " message pickup v2 initiated successfully (took " + pickupDuration + "ms)");
          console.log(walletId + " pickup completed - Pickup v2 protocol working!");
          
          // Emit Artillery metrics for pickup timing
          if (events) {
            events.emit('histogram', 'didcomm.pickup.duration', pickupDuration);
            events.emit('counter', 'didcomm.pickup.success', 1);
          }
          
        } catch (pickupError) {
          console.log(walletId + " message pickup failed: " + pickupError.message);
          console.log(walletId + " pickup error type: " + pickupError.constructor.name);
          
          // Emit Artillery metrics for pickup failures
          if (events) {
            events.emit('counter', 'didcomm.pickup.failed', 1);
          }
        }
        
      } catch (mediationError) {
        console.log(walletId + " mediation failed: " + mediationError.message);
      }
    } else {
      // Check final connection state
      if (connectionRecord) {
        const finalConnection = await agent.connections.getById(connectionRecord.id);
        console.log(walletId + " connection timeout. Final state: " + finalConnection.state);
      } else {
        console.log(walletId + " connection timeout. No connection record.");
      }
    }
    
    console.log("Shutting down agent " + walletId + "...");
    await agent.shutdown();
    
    // Try different callback approaches for Artillery
    if (typeof done === 'function') {
      done();
    } else {
      return Promise.resolve();
    }
  } catch (error) {
    console.error(walletId + " failed:", error.message);
    if (typeof done === 'function') {
      done(error);
    } else {
      throw error;
    }
  }
}

module.exports = { connectToMediator };
