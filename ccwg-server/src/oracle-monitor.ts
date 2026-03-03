// ccwg-web/server/oracle-monitor.ts

import { OracleSystemContractServer } from './oracle-system';

type OracleAsset = 'BTC' | 'ETH' | 'STRK' | 'SOL' | 'DOGE';

export class OracleMonitor {
  private oracleSystem: OracleSystemContractServer;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthState: Map<string, boolean> = new Map();
  private checkCount = 0;

  constructor() {
    this.oracleSystem = new OracleSystemContractServer();
  }

  /**
   * Start monitoring oracle health
   */
  startMonitoring(intervalMs: number = 100000) {
    // Run once immediately on start, then start the interval
    this.checkAllOracleHealth();

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllOracleHealth();
    }, intervalMs);

    console.log('Oracle health monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Oracle health monitoring stopped');
    }
  }

  /**
   * Check health of all oracle feeds
   */
  private async checkAllOracleHealth() {
    const assets: [OracleAsset, number][] = [['BTC', 0], ['ETH', 1], ['STRK', 2], ['SOL', 3], ['DOGE', 4]];
    this.checkCount++;
    // Log full status every 50 checks (~83 min) or on first run
    const verbose = this.checkCount === 1 || this.checkCount % 50 === 0;

    for (const [assetName, assetIndex] of assets) {
      try {
        const health = await this.oracleSystem.checkOracleHealth(assetIndex);
        const wasHealthy = this.lastHealthState.get(assetName);

        if (!health.is_healthy) {
          console.warn(
            `⚠️ Oracle unhealthy for ${assetName}: staleness ${health.staleness}s`
          );
        } else if (verbose || wasHealthy === false) {
          // Log on periodic verbose check, or when recovering from unhealthy
          console.log(`✅ Oracle healthy for ${assetName}`);
        }

        this.lastHealthState.set(assetName, health.is_healthy);
      } catch (error) {
        console.error(`❌ Oracle check failed for ${assetName}:`, error);
        this.lastHealthState.set(assetName, false);
      }
    }
  }
}
