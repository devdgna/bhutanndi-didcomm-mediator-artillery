const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Configuration management for Artillery tests
 */
class ConfigManager {
  constructor() {
    this.baseConfig = {
      target: process.env.DEFAULT_TARGET || "https://animo-mediator-qa.ngotag.com",
      processor: "./processor-enhanced.js",
      environments: {
        NODE_NO_WARNINGS: 1
      },
      http: {
        timeout: 30,
        pool: 50
      }
    };
  }

  /**
   * Generate dynamic test configuration
   */
  generateConfig(options = {}) {
    const {
      name = "Dynamic Test",
      phases = [],
      scenarios = [],
      thresholds = {},
      httpSettings = {}
    } = options;

    const config = {
      config: {
        ...this.baseConfig,
        phases,
        http: { ...this.baseConfig.http, ...httpSettings },
        ensure: {
          thresholds: Object.entries(thresholds).map(([key, value]) => ({ [key]: value }))
        }
      },
      scenarios: scenarios.length > 0 ? scenarios : [{
        name,
        weight: 100,
        flow: [{ function: "connectToMediator" }]
      }]
    };

    return config;
  }

  /**
   * Create a custom test configuration file
   */
  createCustomTest({
    wallets = 100,
    duration = 60,
    rate = 5,
    rampDuration = 30,
    filename = null,
    testType = 'custom'
  }) {
    const phases = [];
    
    switch (testType) {
      case 'ramp':
        phases.push(
          { duration: rampDuration, arrivalRate: 1, rampTo: rate, name: "Ramp-up" },
          { duration: duration, arrivalRate: rate, name: "Sustained Load" },
          { duration: rampDuration, arrivalRate: rate, rampTo: 1, name: "Cool-down" }
        );
        break;
        
      case 'burst':
        phases.push(
          { duration: 5, arrivalRate: 1, name: "Baseline" },
          { duration: 10, arrivalRate: rate * 5, name: "Burst" },
          { duration: duration, arrivalRate: 0, name: "Recovery" }
        );
        break;
        
      case 'spike':
        phases.push(
          { duration: 10, arrivalRate: 1, name: "Baseline" },
          { duration: 5, arrivalRate: rate * 10, name: "Spike" },
          { duration: 30, arrivalRate: 0, name: "Recovery" },
          { duration: 5, arrivalRate: rate * 8, name: "Second Spike" },
          { duration: duration, arrivalRate: 0, name: "Final Recovery" }
        );
        break;
        
      default: // custom
        phases.push({
          duration,
          arrivalRate: rate,
          name: `Custom Load (${rate} wallets/sec for ${duration}s)`
        });
    }

    const config = this.generateConfig({
      name: `${testType.charAt(0).toUpperCase() + testType.slice(1)} Test - ${wallets} wallets`,
      phases,
      thresholds: {
        'http.response_time.p95': 10000,
        'didcomm.connection.duration.p95': 8000,
        'didcomm.mediation.duration.p95': 5000
      }
    });

    if (filename) {
      this.saveConfig(config, filename);
    }

    return config;
  }

  /**
   * Save configuration to YAML file
   */
  saveConfig(config, filename) {
    const yamlContent = yaml.dump(config, { 
      lineWidth: -1,
      noRefs: true,
      sortKeys: false 
    });
    
    fs.writeFileSync(filename, yamlContent, 'utf8');
    return filename;
  }

  /**
   * Load and validate configuration file
   */
  loadConfig(filename) {
    if (!fs.existsSync(filename)) {
      throw new Error(`Configuration file not found: ${filename}`);
    }

    const content = fs.readFileSync(filename, 'utf8');
    const config = yaml.load(content);
    
    // Basic validation
    if (!config.config || !config.scenarios) {
      throw new Error('Invalid configuration format');
    }

    return config;
  }

  /**
   * Create optimized configurations for different test scales
   */
  createOptimizedConfigs() {
    const configs = {
      // Small scale test
      small: this.createCustomTest({
        wallets: 50,
        duration: 30,
        rate: 3,
        testType: 'ramp',
        filename: path.join(__dirname, 'small-optimized.yml')
      }),

      // Medium scale test  
      medium: this.createCustomTest({
        wallets: 200,
        duration: 60,
        rate: 8,
        testType: 'ramp',
        filename: path.join(__dirname, 'medium-optimized.yml')
      }),

      // Large scale test
      large: this.createCustomTest({
        wallets: 500,
        duration: 120,
        rate: 15,
        testType: 'ramp',
        filename: path.join(__dirname, 'large-optimized.yml')
      })
    };

    return configs;
  }
}

module.exports = ConfigManager;
