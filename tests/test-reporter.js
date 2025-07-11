const fs = require('fs');
const path = require('path');

/**
 * Enhanced reporting and analytics for Artillery test results
 */
class TestReporter {
  constructor() {
    this.reportTemplate = this.getReportTemplate();
  }

  /**
   * Parse Artillery JSON results and generate enhanced report
   */
  generateEnhancedReport(resultsFile, outputFile = null) {
    if (!fs.existsSync(resultsFile)) {
      throw new Error(`Results file not found: ${resultsFile}`);
    }

    const rawData = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    const analysis = this.analyzeResults(rawData);
    
    if (!outputFile) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      outputFile = `enhanced-report-${timestamp}.html`;
    }

    const htmlReport = this.generateHTMLReport(analysis);
    fs.writeFileSync(outputFile, htmlReport, 'utf8');

    // Also generate JSON summary
    const jsonSummary = path.join(path.dirname(outputFile), 
      path.basename(outputFile, '.html') + '-summary.json');
    fs.writeFileSync(jsonSummary, JSON.stringify(analysis, null, 2), 'utf8');

    return { htmlReport: outputFile, jsonSummary, analysis };
  }

  /**
   * Analyze Artillery results with DIDComm-specific metrics
   */
  analyzeResults(rawData) {
    const aggregate = rawData.aggregate;
    const intermediate = rawData.intermediate || [];

    const analysis = {
      testInfo: this.extractTestInfo(rawData),
      performance: this.analyzePerformance(aggregate),
      didcommMetrics: this.analyzeDIDCommMetrics(aggregate),
      timeline: this.analyzeTimeline(intermediate),
      errorAnalysis: this.analyzeErrors(aggregate, intermediate),
      recommendations: []
    };

    // Generate recommendations based on analysis
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Extract basic test information
   */
  extractTestInfo(rawData) {
    const phases = rawData.aggregate.phases || {};
    const firstTimestamp = rawData.aggregate.firstCounterAt;
    const lastTimestamp = rawData.aggregate.lastCounterAt;

    return {
      startTime: firstTimestamp ? new Date(firstTimestamp).toISOString() : 'Unknown',
      endTime: lastTimestamp ? new Date(lastTimestamp).toISOString() : 'Unknown',
      duration: lastTimestamp && firstTimestamp ? 
        Math.round((lastTimestamp - firstTimestamp) / 1000) : 0,
      phases: Object.keys(phases).length,
      totalRequests: rawData.aggregate.counters?.['vusers.created'] || 0
    };
  }

  /**
   * Analyze general performance metrics
   */
  analyzePerformance(aggregate) {
    const histograms = aggregate.histograms || {};
    const counters = aggregate.counters || {};
    const rates = aggregate.rates || {};

    return {
      throughput: {
        requestsPerSecond: rates['http.requests'] || 0,
        responsesPerSecond: rates['http.responses'] || 0
      },
      latency: {
        http: this.extractLatencyMetrics(histograms['http.response_time']),
        connection: this.extractLatencyMetrics(histograms['didcomm.connection.duration']),
        mediation: this.extractLatencyMetrics(histograms['didcomm.mediation.duration']),
        pickup: this.extractLatencyMetrics(histograms['didcomm.pickup.duration'])
      },
      success: {
        total: counters['vusers.completed'] || 0,
        failed: counters['vusers.failed'] || 0,
        successRate: this.calculateSuccessRate(counters)
      }
    };
  }

  /**
   * Analyze DIDComm-specific metrics
   */
  analyzeDIDCommMetrics(aggregate) {
    const counters = aggregate.counters || {};
    const histograms = aggregate.histograms || {};

    return {
      connections: {
        successful: counters['didcomm.connection.success'] || 0,
        failed: counters['didcomm.connection.failed'] || 0,
        successRate: this.calculateRate(
          counters['didcomm.connection.success'],
          counters['didcomm.connection.failed']
        ),
        avgDuration: this.getAverage(histograms['didcomm.connection.duration'])
      },
      mediation: {
        successful: counters['didcomm.mediation.success'] || 0,
        failed: counters['didcomm.mediation.failed'] || 0,
        successRate: this.calculateRate(
          counters['didcomm.mediation.success'],
          counters['didcomm.mediation.failed']
        ),
        avgDuration: this.getAverage(histograms['didcomm.mediation.duration'])
      },
      pickup: {
        successful: counters['didcomm.pickup.success'] || 0,
        failed: counters['didcomm.pickup.failed'] || 0,
        successRate: this.calculateRate(
          counters['didcomm.pickup.success'],
          counters['didcomm.pickup.failed']
        ),
        avgDuration: this.getAverage(histograms['didcomm.pickup.duration'])
      },
      overall: {
        testSuccess: counters['didcomm.test.success'] || 0,
        testFailed: counters['didcomm.test.failed'] || 0,
        overallSuccessRate: this.calculateRate(
          counters['didcomm.test.success'],
          counters['didcomm.test.failed']
        )
      }
    };
  }

  /**
   * Analyze timeline and phases
   */
  analyzeTimeline(intermediate) {
    if (!intermediate || intermediate.length === 0) {
      return { phases: [], trend: 'No timeline data available' };
    }

    const phases = intermediate.map(phase => ({
      timestamp: new Date(phase.timestamp).toISOString(),
      requestsPerSecond: phase.counters?.['http.requests'] || 0,
      avgResponseTime: this.getAverage(phase.histograms?.['http.response_time']) || 0,
      errors: phase.counters?.['vusers.failed'] || 0,
      didcommConnections: phase.counters?.['didcomm.connection.success'] || 0
    }));

    return {
      phases,
      trend: this.analyzeTrend(phases)
    };
  }

  /**
   * Analyze errors and failure patterns
   */
  analyzeErrors(aggregate, intermediate) {
    const counters = aggregate.counters || {};
    const errors = aggregate.errors || {};

    const analysis = {
      totalErrors: counters['vusers.failed'] || 0,
      errorRate: this.calculateErrorRate(counters),
      errorTypes: this.categorizeErrors(errors),
      didcommErrors: {
        connection: counters['didcomm.connection.failed'] || 0,
        mediation: counters['didcomm.mediation.failed'] || 0,
        pickup: counters['didcomm.pickup.failed'] || 0,
        processing: counters['didcomm.processing.failed'] || 0
      }
    };

    return analysis;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Performance recommendations
    if (analysis.performance.success.successRate < 0.95) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message: `Low success rate (${(analysis.performance.success.successRate * 100).toFixed(1)}%). Consider reducing load or investigating failures.`
      });
    }

    // Latency recommendations
    const connectionLatency = analysis.performance.latency.connection;
    if (connectionLatency && connectionLatency.p95 > 10000) {
      recommendations.push({
        type: 'latency',
        severity: 'medium',
        message: `High connection latency (P95: ${connectionLatency.p95}ms). Consider optimizing connection handling.`
      });
    }

    // DIDComm specific recommendations
    if (analysis.didcommMetrics.pickup.successRate < 0.9) {
      recommendations.push({
        type: 'didcomm',
        severity: 'low',
        message: 'Message pickup has high failure rate. This may be expected during load testing.'
      });
    }

    // Error rate recommendations
    if (analysis.errorAnalysis.errorRate > 0.1) {
      recommendations.push({
        type: 'errors',
        severity: 'high',
        message: `High error rate (${(analysis.errorAnalysis.errorRate * 100).toFixed(1)}%). Investigate error patterns and system capacity.`
      });
    }

    return recommendations;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(analysis) {
    return this.reportTemplate
      .replace('{{TEST_INFO}}', this.renderTestInfo(analysis.testInfo))
      .replace('{{PERFORMANCE_SUMMARY}}', this.renderPerformanceSummary(analysis.performance))
      .replace('{{DIDCOMM_METRICS}}', this.renderDIDCommMetrics(analysis.didcommMetrics))
      .replace('{{ERROR_ANALYSIS}}', this.renderErrorAnalysis(analysis.errorAnalysis))
      .replace('{{RECOMMENDATIONS}}', this.renderRecommendations(analysis.recommendations))
      .replace('{{TIMELINE_DATA}}', JSON.stringify(analysis.timeline.phases))
      .replace('{{ANALYSIS_DATA}}', JSON.stringify(analysis, null, 2));
  }

  // Helper methods
  extractLatencyMetrics(histogram) {
    if (!histogram) return null;
    return {
      min: histogram.min,
      max: histogram.max,
      p50: histogram.p50,
      p95: histogram.p95,
      p99: histogram.p99,
      mean: histogram.mean
    };
  }

  calculateSuccessRate(counters) {
    const completed = counters['vusers.completed'] || 0;
    const failed = counters['vusers.failed'] || 0;
    const total = completed + failed;
    return total > 0 ? completed / total : 0;
  }

  calculateErrorRate(counters) {
    const completed = counters['vusers.completed'] || 0;
    const failed = counters['vusers.failed'] || 0;
    const total = completed + failed;
    return total > 0 ? failed / total : 0;
  }

  calculateRate(success, failed) {
    const total = (success || 0) + (failed || 0);
    return total > 0 ? (success || 0) / total : 0;
  }

  getAverage(histogram) {
    return histogram ? histogram.mean : null;
  }

  analyzeTrend(phases) {
    if (phases.length < 2) return 'Insufficient data';
    
    const first = phases[0];
    const last = phases[phases.length - 1];
    
    if (last.avgResponseTime > first.avgResponseTime * 1.2) {
      return 'Performance degrading over time';
    } else if (last.avgResponseTime < first.avgResponseTime * 0.8) {
      return 'Performance improving over time';
    } else {
      return 'Stable performance';
    }
  }

  categorizeErrors(errors) {
    // Implement error categorization logic
    return Object.keys(errors || {}).map(key => ({
      type: key,
      count: errors[key]
    }));
  }

  // Rendering methods
  renderTestInfo(testInfo) {
    return `
      <div class="test-info">
        <h3>Test Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Start Time:</label>
            <span>${testInfo.startTime}</span>
          </div>
          <div class="info-item">
            <label>Duration:</label>
            <span>${testInfo.duration}s</span>
          </div>
          <div class="info-item">
            <label>Total Requests:</label>
            <span>${testInfo.totalRequests}</span>
          </div>
          <div class="info-item">
            <label>Phases:</label>
            <span>${testInfo.phases}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderPerformanceSummary(performance) {
    return `
      <div class="performance-summary">
        <h3>Performance Summary</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <h4>Success Rate</h4>
            <div class="metric-value ${performance.success.successRate > 0.95 ? 'good' : 'warning'}">
              ${(performance.success.successRate * 100).toFixed(1)}%
            </div>
          </div>
          <div class="metric-card">
            <h4>Requests/sec</h4>
            <div class="metric-value">${performance.throughput.requestsPerSecond.toFixed(1)}</div>
          </div>
          <div class="metric-card">
            <h4>Avg Response Time</h4>
            <div class="metric-value">${performance.latency.http?.mean?.toFixed(0) || 'N/A'}ms</div>
          </div>
          <div class="metric-card">
            <h4>P95 Response Time</h4>
            <div class="metric-value">${performance.latency.http?.p95?.toFixed(0) || 'N/A'}ms</div>
          </div>
        </div>
      </div>
    `;
  }

  renderDIDCommMetrics(didcommMetrics) {
    return `
      <div class="didcomm-metrics">
        <h3>DIDComm Protocol Metrics</h3>
        <div class="protocol-grid">
          <div class="protocol-card">
            <h4>Connection Establishment</h4>
            <div class="protocol-stats">
              <div>Success: ${didcommMetrics.connections.successful}</div>
              <div>Failed: ${didcommMetrics.connections.failed}</div>
              <div>Rate: ${(didcommMetrics.connections.successRate * 100).toFixed(1)}%</div>
              <div>Avg Duration: ${didcommMetrics.connections.avgDuration?.toFixed(0) || 'N/A'}ms</div>
            </div>
          </div>
          <div class="protocol-card">
            <h4>Mediation Setup</h4>
            <div class="protocol-stats">
              <div>Success: ${didcommMetrics.mediation.successful}</div>
              <div>Failed: ${didcommMetrics.mediation.failed}</div>
              <div>Rate: ${(didcommMetrics.mediation.successRate * 100).toFixed(1)}%</div>
              <div>Avg Duration: ${didcommMetrics.mediation.avgDuration?.toFixed(0) || 'N/A'}ms</div>
            </div>
          </div>
          <div class="protocol-card">
            <h4>Message Pickup</h4>
            <div class="protocol-stats">
              <div>Success: ${didcommMetrics.pickup.successful}</div>
              <div>Failed: ${didcommMetrics.pickup.failed}</div>
              <div>Rate: ${(didcommMetrics.pickup.successRate * 100).toFixed(1)}%</div>
              <div>Avg Duration: ${didcommMetrics.pickup.avgDuration?.toFixed(0) || 'N/A'}ms</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderErrorAnalysis(errorAnalysis) {
    return `
      <div class="error-analysis">
        <h3>Error Analysis</h3>
        <div class="error-summary">
          <div>Total Errors: ${errorAnalysis.totalErrors}</div>
          <div>Error Rate: ${(errorAnalysis.errorRate * 100).toFixed(2)}%</div>
        </div>
        <div class="error-breakdown">
          <h4>DIDComm Error Breakdown</h4>
          <ul>
            <li>Connection Errors: ${errorAnalysis.didcommErrors.connection}</li>
            <li>Mediation Errors: ${errorAnalysis.didcommErrors.mediation}</li>
            <li>Pickup Errors: ${errorAnalysis.didcommErrors.pickup}</li>
            <li>Processing Errors: ${errorAnalysis.didcommErrors.processing}</li>
          </ul>
        </div>
      </div>
    `;
  }

  renderRecommendations(recommendations) {
    if (recommendations.length === 0) {
      return '<div class="recommendations"><h3>Recommendations</h3><p>No specific recommendations. Test results look good!</p></div>';
    }

    const recommendationItems = recommendations.map(rec => `
      <div class="recommendation ${rec.severity}">
        <span class="severity">${rec.severity.toUpperCase()}</span>
        <span class="message">${rec.message}</span>
      </div>
    `).join('');

    return `
      <div class="recommendations">
        <h3>Recommendations</h3>
        ${recommendationItems}
      </div>
    `;
  }

  getReportTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIDComm Load Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .section { margin-bottom: 40px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
        .metric-value { font-size: 2em; font-weight: bold; color: #667eea; }
        .metric-value.good { color: #28a745; }
        .metric-value.warning { color: #ffc107; }
        .metric-value.danger { color: #dc3545; }
        .protocol-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .protocol-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .protocol-stats div { margin: 5px 0; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .info-item { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .recommendations .recommendation { margin: 10px 0; padding: 15px; border-radius: 4px; }
        .recommendations .high { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendations .medium { background: #fff3cd; border-left: 4px solid #ffc107; }
        .recommendations .low { background: #d4edda; border-left: 4px solid #28a745; }
        .severity { font-weight: bold; margin-right: 10px; }
        h1, h2, h3 { color: #333; }
        .chart-container { margin: 20px 0; height: 300px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔗 DIDComm Mediator Load Test Report</h1>
            <p>Comprehensive analysis of DIDComm protocol performance and scalability</p>
        </div>
        
        <div class="content">
            <div class="section">
                {{TEST_INFO}}
            </div>
            
            <div class="section">
                {{PERFORMANCE_SUMMARY}}
            </div>
            
            <div class="section">
                {{DIDCOMM_METRICS}}
            </div>
            
            <div class="section">
                {{ERROR_ANALYSIS}}
            </div>
            
            <div class="section">
                {{RECOMMENDATIONS}}
            </div>
            
            <div class="section">
                <h3>Timeline Chart</h3>
                <div class="chart-container">
                    <canvas id="timelineChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Timeline chart
        const timelineData = {{TIMELINE_DATA}};
        const ctx = document.getElementById('timelineChart').getContext('2d');
        
        if (timelineData && timelineData.length > 0) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timelineData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                    datasets: [{
                        label: 'Requests/sec',
                        data: timelineData.map(d => d.requestsPerSecond),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Avg Response Time (ms)',
                        data: timelineData.map(d => d.avgResponseTime),
                        borderColor: '#764ba2',
                        backgroundColor: 'rgba(118, 75, 162, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: {
                                drawOnChartArea: false,
                            },
                        }
                    }
                }
            });
        } else {
            document.querySelector('.chart-container').innerHTML = '<p>No timeline data available</p>';
        }
    </script>
</body>
</html>
    `;
  }
}

module.exports = TestReporter;
