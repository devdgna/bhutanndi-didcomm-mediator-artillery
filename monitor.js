const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

/**
 * System performance monitor for load testing
 */
class PerformanceMonitor {
  constructor(options = {}) {
    this.interval = options.interval || 5000; // 5 seconds
    this.outputFile = options.outputFile || `performance-${Date.now()}.json`;
    this.monitoring = false;
    this.data = [];
    this.startTime = Date.now();
  }

  /**
   * Start monitoring system performance
   */
  start() {
    if (this.monitoring) {
      console.log('⚠️  Performance monitoring already running');
      return;
    }

    console.log(`📊 Starting performance monitoring (${this.interval}ms interval)`);
    console.log(`📁 Logging to: ${this.outputFile}`);
    
    this.monitoring = true;
    this.monitorLoop();
  }

  /**
   * Stop monitoring and save results
   */
  stop() {
    if (!this.monitoring) {
      console.log('⚠️  Performance monitoring not running');
      return;
    }

    this.monitoring = false;
    this.saveResults();
    console.log('🛑 Performance monitoring stopped');
    console.log(`📊 Results saved to: ${this.outputFile}`);
  }

  /**
   * Main monitoring loop
   */
  async monitorLoop() {
    while (this.monitoring) {
      try {
        const metrics = await this.collectMetrics();
        this.data.push(metrics);
        this.logMetrics(metrics);
        
        // Save periodically
        if (this.data.length % 10 === 0) {
          this.saveResults();
        }
        
        await this.sleep(this.interval);
      } catch (error) {
        console.error('❌ Error collecting metrics:', error.message);
      }
    }
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();
    const uptime = timestamp - this.startTime;

    return {
      timestamp: new Date(timestamp).toISOString(),
      uptime,
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      network: await this.getNetworkMetrics(),
      disk: await this.getDiskMetrics(),
      processes: await this.getProcessMetrics()
    };
  }

  /**
   * Get CPU metrics
   */
  getCPUMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    return {
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
      },
      usage: this.calculateCPUUsage()
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    return {
      idle: ((idle / total) * 100).toFixed(2),
      usage: (100 - (idle / total) * 100).toFixed(2)
    };
  }

  /**
   * Get memory metrics
   */
  getMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      total: this.formatBytes(totalMem),
      free: this.formatBytes(freeMem),
      used: this.formatBytes(usedMem),
      usage: ((usedMem / totalMem) * 100).toFixed(2),
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem
    };
  }

  /**
   * Get network metrics (Linux/macOS)
   */
  async getNetworkMetrics() {
    try {
      if (process.platform === 'linux') {
        return this.getLinuxNetworkMetrics();
      } else if (process.platform === 'darwin') {
        return this.getMacNetworkMetrics();
      } else {
        return { error: 'Platform not supported for network metrics' };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get Linux network metrics
   */
  getLinuxNetworkMetrics() {
    try {
      const netstat = execSync('cat /proc/net/dev', { encoding: 'utf8' });
      const lines = netstat.trim().split('\n').slice(2); // Skip header lines
      
      let totalRx = 0;
      let totalTx = 0;

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] && !parts[0].startsWith('lo:')) { // Skip loopback
          totalRx += parseInt(parts[1]) || 0;
          totalTx += parseInt(parts[9]) || 0;
        }
      });

      return {
        bytesReceived: totalRx,
        bytesTransmitted: totalTx,
        received: this.formatBytes(totalRx),
        transmitted: this.formatBytes(totalTx)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get macOS network metrics
   */
  getMacNetworkMetrics() {
    try {
      const netstat = execSync('netstat -ibn', { encoding: 'utf8' });
      const lines = netstat.trim().split('\n').slice(1); // Skip header
      
      let totalRx = 0;
      let totalTx = 0;

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] && !parts[0].startsWith('lo')) { // Skip loopback
          totalRx += parseInt(parts[6]) || 0;
          totalTx += parseInt(parts[9]) || 0;
        }
      });

      return {
        bytesReceived: totalRx,
        bytesTransmitted: totalTx,
        received: this.formatBytes(totalRx),
        transmitted: this.formatBytes(totalTx)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get disk usage metrics
   */
  async getDiskMetrics() {
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const df = execSync('df -h /', { encoding: 'utf8' });
        const lines = df.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].trim().split(/\s+/);
          return {
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usage: parts[4]
          };
        }
      }
      return { error: 'Could not get disk metrics' };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get process metrics (Node.js and Artillery)
   */
  async getProcessMetrics() {
    const nodeProcess = process.memoryUsage();
    
    const metrics = {
      node: {
        pid: process.pid,
        memory: {
          rss: this.formatBytes(nodeProcess.rss),
          heapTotal: this.formatBytes(nodeProcess.heapTotal),
          heapUsed: this.formatBytes(nodeProcess.heapUsed),
          external: this.formatBytes(nodeProcess.external)
        },
        uptime: process.uptime()
      }
    };

    // Try to get Artillery process info
    try {
      const pgrep = execSync('pgrep -f artillery', { encoding: 'utf8' }).trim();
      const pids = pgrep.split('\n').filter(Boolean);
      
      if (pids.length > 0) {
        metrics.artillery = {
          processes: pids.length,
          pids: pids
        };
      }
    } catch (error) {
      // Artillery might not be running
    }

    return metrics;
  }

  /**
   * Log metrics to console
   */
  logMetrics(metrics) {
    const time = new Date(metrics.timestamp).toLocaleTimeString();
    console.log(`[${time}] CPU: ${metrics.cpu.usage.usage}% | RAM: ${metrics.memory.usage}% | Load: ${metrics.cpu.loadAverage['1min'].toFixed(2)}`);
  }

  /**
   * Save results to file
   */
  saveResults() {
    const summary = {
      monitoring: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        samples: this.data.length
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        hostname: os.hostname(),
        cpus: os.cpus().length
      },
      data: this.data,
      summary: this.generateSummary()
    };

    fs.writeFileSync(this.outputFile, JSON.stringify(summary, null, 2));
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    if (this.data.length === 0) return {};

    const cpuUsages = this.data.map(d => parseFloat(d.cpu.usage.usage)).filter(Boolean);
    const memUsages = this.data.map(d => parseFloat(d.memory.usage)).filter(Boolean);
    const loadAvgs = this.data.map(d => d.cpu.loadAverage['1min']).filter(Boolean);

    return {
      cpu: {
        avg: this.average(cpuUsages).toFixed(2),
        max: Math.max(...cpuUsages).toFixed(2),
        min: Math.min(...cpuUsages).toFixed(2)
      },
      memory: {
        avg: this.average(memUsages).toFixed(2),
        max: Math.max(...memUsages).toFixed(2),
        min: Math.min(...memUsages).toFixed(2)
      },
      load: {
        avg: this.average(loadAvgs).toFixed(2),
        max: Math.max(...loadAvgs).toFixed(2),
        min: Math.min(...loadAvgs).toFixed(2)
      }
    };
  }

  /**
   * Utility functions
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const monitor = new PerformanceMonitor({
    interval: args.includes('--fast') ? 1000 : 5000,
    outputFile: args.find(arg => arg.startsWith('--output='))?.split('=')[1]
  });

  console.log('🚀 DIDComm Load Test Performance Monitor');
  console.log('Press Ctrl+C to stop monitoring');

  monitor.start();

  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping monitor...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });
}

module.exports = PerformanceMonitor;
