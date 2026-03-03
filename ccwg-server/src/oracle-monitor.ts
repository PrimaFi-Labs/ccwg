// ccwg-web/server/oracle-monitor.ts

import { OracleSystemContractServer } from './oracle-system';

type OracleAsset = 'BTC' | 'ETH' | 'STRK' | 'SOL' | 'DOGE';

export class OracleMonitor {
  private oracleSystem: OracleSystemContractServer;
  private healthCheckInterval: NodeJS.Timeout | null = null;

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

    for (const [assetName, assetIndex] of assets) {
      try {
        const health = await this.oracleSystem.checkOracleHealth(assetIndex);

        if (!health.is_healthy) {
          console.warn(
            `⚠️ Oracle unhealthy for ${assetName}: staleness ${health.staleness}s`
          );
        } else {
          console.log(`✅ Oracle healthy for ${assetName}`);
        }
      } catch (error) {
        console.error(`❌ Oracle check failed for ${assetName}:`, error);
      }
    }
  }
}
