// ccwg-server/src/index.ts

import WebSocket, { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { MatchOrchestrator } from './match-orchestrator';
import { AIEngine } from './ai-engine';
import { OracleMonitor } from './oracle-monitor';
import type { WSMessage, Database } from '@ccwg/shared';

dotenv.config({ path: '.env' });
// Also try .env.local for backwards compat with dev setups
dotenv.config({ path: '.env.local' });

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}



function parseJson<T>(input: string): T {
  return JSON.parse(input) as T;
}

// ✅ Server must use service role key (orchestrator + AI insert/update needs it)
const SUPABASE_URL = assertEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = assertEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const PORT = Number.parseInt(process.env.WS_PORT ?? '3001', 10);

// Create HTTP server for WebSocket
const server = createServer();
const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 1024, // 1MB
});

// Initialize match orchestrator and AI engine
const matchOrchestrator = new MatchOrchestrator();
const aiEngine = new AIEngine(supabase);

// Start oracle monitoring
const oracleMonitor = new OracleMonitor();
oracleMonitor.startMonitoring(60_000);

// Store client connections
const clients = new Map<string, WebSocket>();

// Keepalive (helps on Render/Fly/NGINX proxies)
const HEARTBEAT_MS = 30_000;

function heartbeat(this: WebSocket) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (this as any).isAlive = true;
}

const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAlive = (ws as any).isAlive as boolean | undefined;

    if (isAlive === false) {
      ws.terminate();
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any).isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

heartbeatInterval.unref?.();

wss.on('connection', (ws: WebSocket, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any).isAlive = true;
  ws.on('pong', heartbeat);

  let clientId: string | null = null;

  ws.on('message', async (data: WebSocket.RawData) => {
    try {
      const raw = data.toString();
      const message = parseJson<WSMessage>(raw);

      console.log('Received message:', message.type);

      switch (message.type) {
        case 'join_match': {
          const { match_id, player_wallet } = message.payload;
          clientId = player_wallet;
          clients.set(player_wallet, ws);

          await matchOrchestrator.handlePlayerJoin(match_id, player_wallet, ws);
          break;
        }

        case 'leave_match': {
          const { match_id, player_wallet } = message.payload;
          await matchOrchestrator.handlePlayerLeave(match_id, player_wallet);
          clients.delete(player_wallet);
          break;
        }

        case 'select_card': {
          await matchOrchestrator.handleCardSelection(message.payload);
          break;
        }

        case 'submit_action': {
          await matchOrchestrator.handleActionSubmission(message.payload);
          break;
        }

        case 'swap_card': {
          await matchOrchestrator.handleCardSwap(message.payload);
          break;
        }

        case 'use_charge': {
          await matchOrchestrator.handleChargeUse(message.payload);
          break;
        }

        default: {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'Unknown message type' },
              timestamp: Date.now(),
            })
          );
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            message: error instanceof Error ? error.message : 'Internal server error',
          },
          timestamp: Date.now(),
        })
      );
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected:', clientId);
    if (clientId) clients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send connection acknowledgment
  ws.send(
    JSON.stringify({
      type: 'connected',
      payload: { message: 'Connected to CCWG match server' },
      timestamp: Date.now(),
    })
  );
});

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        connections: clients.size,
        activeMatches: matchOrchestrator.getActiveMatchCount(),
      })
    );
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`🎮 CCWG WebSocket server running on ws://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`${signal} signal received: closing WebSocket server`);

  oracleMonitor.stopMonitoring();
  aiEngine.stopAllTimers();

  clearInterval(heartbeatInterval);

  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('Force exiting: shutdown timed out');
    process.exit(1);
  }, 10_000).unref?.();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
