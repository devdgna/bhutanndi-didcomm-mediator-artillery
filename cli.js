#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ConfigManager = require('./tests/config-manager');
const TestReporter = require('./tests/test-reporter');

const program = new Command();
const configManager = new ConfigManager();
const reporter = new TestReporter();

program
  .name('artillery-didcomm')
  .description('Enhanced DIDComm Artillery Load Testing CLI')
  .version('1.0.0');

// Test command
program
  .command('test')
  .description('Run load tests with various options')
  .option('-w, --wallets <number>', 'Number of wallets to create', '100')
  .option('-d, --duration <number>', 'Test duration in seconds', '60')
  .option('-r, --rate <number>', 'Wallets per second', '5')
  .option('-t, --type <type>', 'Test type: custom, ramp, burst, spike, stress', 'custom')
  .option('--target <url>', 'Target mediator URL')
  .option('--cloud', 'Use Artillery Cloud')
  .option('--enhanced', 'Use enhanced processor', true)
  .option('--report', 'Generate enhanced report after test', true)
  .action(async (options) => {
    try {
      console.log('🚀 Starting DIDComm Load Test...');
      console.log(`📊 Configuration: ${options.wallets} wallets, ${options.duration}s duration, ${options.rate}/s rate`);
      
      // Generate test configuration
      const config = configManager.createCustomTest({
        wallets: parseInt(options.wallets),
        duration: parseInt(options.duration),
        rate: parseInt(options.rate),
        testType: options.type
      });

      // Override target if specified
      if (options.target) {
        config.config.target = options.target;
      }

      // Use enhanced processor if requested
      if (options.enhanced) {
        config.config.processor = './tests/processor-enhanced.js';
      }

      // Create temporary config file
      const tempConfigFile = `temp-${Date.now()}.yml`;
      configManager.saveConfig(config, tempConfigFile);

      // Prepare Artillery command
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = `results-${options.type}-${options.wallets}w-${timestamp}.json`;
      
      let command = `npx artillery run ${tempConfigFile} --output ${outputFile}`;
      
      if (options.cloud) {
        command += ` --record --name "DIDComm ${options.type} test - ${options.wallets} wallets"`;
      }

      console.log('🎯 Running Artillery test...');
      
      // Execute test
      execSync(command, { stdio: 'inherit' });

      // Clean up temp file
      fs.unlinkSync(tempConfigFile);

      console.log('✅ Test completed!');
      console.log(`📄 Results saved to: ${outputFile}`);

      // Generate enhanced report if requested
      if (options.report) {
        console.log('📊 Generating enhanced report...');
        const reportResult = reporter.generateEnhancedReport(outputFile);
        console.log(`📋 Enhanced report: ${reportResult.htmlReport}`);
        console.log(`📈 JSON summary: ${reportResult.jsonSummary}`);
      }

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate enhanced report from existing results')
  .argument('<results-file>', 'Artillery results JSON file')
  .option('-o, --output <file>', 'Output HTML file')
  .action((resultsFile, options) => {
    try {
      console.log('📊 Generating enhanced report...');
      const result = reporter.generateEnhancedReport(resultsFile, options.output);
      console.log(`✅ Report generated: ${result.htmlReport}`);
      console.log(`📈 Summary: ${result.jsonSummary}`);
    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage test configurations')
  .option('--create <type>', 'Create optimized configs: small, medium, large, all')
  .option('--validate <file>', 'Validate configuration file')
  .action((options) => {
    try {
      if (options.create) {
        if (options.create === 'all') {
          console.log('🔧 Creating optimized configurations...');
          configManager.createOptimizedConfigs();
          console.log('✅ Created: small-optimized.yml, medium-optimized.yml, large-optimized.yml');
        } else {
          console.log(`🔧 Creating ${options.create} configuration...`);
          const configs = configManager.createOptimizedConfigs();
          if (configs[options.create]) {
            console.log(`✅ Created: ${options.create}-optimized.yml`);
          } else {
            console.error('❌ Unknown configuration type. Use: small, medium, large, or all');
          }
        }
      }

      if (options.validate) {
        console.log(`🔍 Validating ${options.validate}...`);
        configManager.loadConfig(options.validate);
        console.log('✅ Configuration is valid');
      }
    } catch (error) {
      console.error('❌ Configuration operation failed:', error.message);
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor live test results')
  .argument('<results-file>', 'Artillery results JSON file to monitor')
  .action((resultsFile) => {
    console.log(`👀 Monitoring ${resultsFile}...`);
    console.log('Press Ctrl+C to stop monitoring');
    
    let lastSize = 0;
    
    const monitor = setInterval(() => {
      try {
        if (fs.existsSync(resultsFile)) {
          const stats = fs.statSync(resultsFile);
          if (stats.size > lastSize) {
            const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
            if (data.intermediate && data.intermediate.length > 0) {
              const latest = data.intermediate[data.intermediate.length - 1];
              const timestamp = new Date(latest.timestamp).toLocaleTimeString();
              const rps = latest.counters?.['http.requests'] || 0;
              const errors = latest.counters?.['vusers.failed'] || 0;
              
              console.log(`[${timestamp}] RPS: ${rps.toFixed(1)}, Errors: ${errors}`);
            }
            lastSize = stats.size;
          }
        }
      } catch (error) {
        // Ignore errors during monitoring
      }
    }, 2000);

    process.on('SIGINT', () => {
      clearInterval(monitor);
      console.log('\n👋 Monitoring stopped');
      process.exit(0);
    });
  });

// Quick test commands
program
  .command('quick')
  .description('Quick predefined tests')
  .argument('<size>', 'Test size: small, medium, large')
  .option('--enhanced', 'Use enhanced processor', true)
  .action(async (size, options) => {
    const configs = {
      small: { wallets: 25, duration: 30, rate: 2, type: 'ramp' },
      medium: { wallets: 100, duration: 60, rate: 5, type: 'ramp' },
      large: { wallets: 500, duration: 120, rate: 15, type: 'ramp' }
    };

    const config = configs[size];
    if (!config) {
      console.error('❌ Unknown size. Use: small, medium, or large');
      process.exit(1);
    }

    console.log(`🚀 Running ${size} quick test...`);
    
    // Use the test command with predefined config
    program.parse([
      'node', 'cli.js', 'test',
      '-w', config.wallets.toString(),
      '-d', config.duration.toString(),
      '-r', config.rate.toString(),
      '-t', config.type,
      options.enhanced ? '--enhanced' : '--no-enhanced'
    ]);
  });

// Environment check command
program
  .command('check')
  .description('Check environment and dependencies')
  .action(() => {
    console.log('🔍 Checking environment...');
    
    const checks = [
      {
        name: 'Node.js version',
        check: () => {
          const version = process.version;
          const major = parseInt(version.slice(1).split('.')[0]);
          return { ok: major >= 18, value: version };
        }
      },
      {
        name: 'Artillery installation',
        check: () => {
          try {
            execSync('npx artillery --version', { stdio: 'pipe' });
            return { ok: true, value: 'Installed' };
          } catch {
            return { ok: false, value: 'Not found' };
          }
        }
      },
      {
        name: '.env configuration',
        check: () => {
          const hasEnv = fs.existsSync('.env');
          return { ok: hasEnv, value: hasEnv ? 'Found' : 'Missing' };
        }
      },
      {
        name: 'INVITATION_URL',
        check: () => {
          require('dotenv').config();
          const url = process.env.INVITATION_URL;
          return { ok: !!url, value: url ? 'Configured' : 'Missing' };
        }
      }
    ];

    let allGood = true;
    
    checks.forEach(({ name, check }) => {
      try {
        const result = check();
        const icon = result.ok ? '✅' : '❌';
        console.log(`${icon} ${name}: ${result.value}`);
        if (!result.ok) allGood = false;
      } catch (error) {
        console.log(`❌ ${name}: Error - ${error.message}`);
        allGood = false;
      }
    });

    if (allGood) {
      console.log('\n🎉 Environment looks good! Ready to run tests.');
    } else {
      console.log('\n⚠️  Some issues found. Please fix them before running tests.');
      console.log('💡 Tip: Copy .env.example to .env and configure INVITATION_URL');
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
