//ccwg/ccwg-web/src/hooks/useMatchWebSocket.ts

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessage } from '@/src/types/websocket';

interface UseMatchWebSocketOptions {
  matchId: number;
  playerWallet: string;
  onRoundStart?: (data: unknown) => void;
  onRoundEnd?: (data: unknown) => void;
  onMatchEnd?: (data: unknown) => void;
  onOpponentCardSelected?: (data: unknown) => void;
  onOpponentActionLocked?: (data: unknown) => void;
  onMomentumReveal?: (data: unknown) => void;
  onBotMessage?: (data: { message: string; trigger: string; bot_wallet: string }) => void;
  onAchievementUnlocked?: (data: { achievement_key: string; title: string; description: string; category: string; tier: string; badge_icon: string; badge_color: string }) => void;
  onError?: (error: string) => void;
}

export function useMatchWebSocket({
  matchId,
  playerWallet,
  onRoundStart,
  onRoundEnd,
  onMatchEnd,
  onOpponentCardSelected,
  onOpponentActionLocked,
  onMomentumReveal,
  onBotMessage,
  onAchievementUnlocked,
  onError,
}: UseMatchWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const manualCloseRef = useRef(false);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joinedRef = useRef(false);
  const connectionKeyRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const handlersRef = useRef({
    onRoundStart,
    onRoundEnd,
    onMatchEnd,
    onOpponentCardSelected,
    onOpponentActionLocked,
    onMomentumReveal,
    onBotMessage,
    onAchievementUnlocked,
    onError,
  });

  useEffect(() => {
    handlersRef.current = {
      onRoundStart,
      onRoundEnd,
      onMatchEnd,
      onOpponentCardSelected,
      onOpponentActionLocked,
      onMomentumReveal,
      onBotMessage,
      onAchievementUnlocked,
      onError,
    };
  }, [
    onRoundStart,
    onRoundEnd,
    onMatchEnd,
    onOpponentCardSelected,
    onOpponentActionLocked,
    onMomentumReveal,
    onBotMessage,
    onAchievementUnlocked,
    onError,
  ]);

  const resolveWsUrl = useCallback(() => {
    // First priority: explicit environment variable
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (envUrl) {
      console.log('Using NEXT_PUBLIC_WS_URL:', envUrl);
      return envUrl;
    }

    // Only resolve dynamically in browser
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      
      // For localhost/127.0.0.1, always use ws://localhost:3001
      if (host === 'localhost' || host === '127.0.0.1') {
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001';
        const url = `ws://localhost:${wsPort}`;
        console.log('Using localhost WebSocket URL:', url);
        return url;
      }

      // For production/remote hosts
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT;
      const url = wsPort ? `${protocol}://${host}:${wsPort}` : `${protocol}://${host}`;
      console.log('Using production WebSocket URL:', url);
      return url;
    }

    // Server-side fallback (shouldn't be used since this is 'use client')
    console.warn('Falling back to default ws://localhost:3001');
    return 'ws://localhost:3001';
  }, []);

  const connect = useCallback(function connectToMatch() {
    // Don't connect if component is unmounted
    if (!isMountedRef.current) {
      console.log('Component unmounted, skipping connection');
      return;
    }

    const connectionKey = `${matchId}:${playerWallet}`;
    if (connectionKeyRef.current && connectionKeyRef.current !== connectionKey) {
      console.log('Connection key changed, closing existing connection');
      wsRef.current?.close();
      wsRef.current = null;
      joinedRef.current = false;
    }
    connectionKeyRef.current = connectionKey;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting, skipping');
      return;
    }
    if (isConnectingRef.current) {
      console.log('Already attempting to connect, skipping');
      return;
    }

    isConnectingRef.current = true;
    manualCloseRef.current = false;
    joinedRef.current = false;

    const wsUrl = resolveWsUrl();
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Check if component is still mounted
        if (!isMountedRef.current) {
          console.log('Component unmounted during connection, closing');
          ws.close();
          return;
        }

        console.log('✅ WebSocket connected successfully');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        // Ignore messages if component unmounted
        if (!isMountedRef.current) return;

        try {
          const message: WSMessage = JSON.parse(event.data);
          console.log('Received message:', message.type);

          switch (message.type) {
            case 'connected':
              console.log('Server acknowledged connection');
              setIsConnected(true);
              if (!joinedRef.current && isMountedRef.current) {
                console.log('Sending join_match message');
                ws.send(JSON.stringify({
                  type: 'join_match',
                  payload: { match_id: matchId, player_wallet: playerWallet },
                  timestamp: Date.now(),
                }));
                joinedRef.current = true;
              }
              break;
            case 'round_start':
              setIsConnected(true);
              handlersRef.current.onRoundStart?.(message.payload);
              break;
            case 'round_end':
              handlersRef.current.onRoundEnd?.(message.payload);
              break;
            case 'match_end':
              handlersRef.current.onMatchEnd?.(message.payload);
              break;
            case 'opponent_card_selected':
              handlersRef.current.onOpponentCardSelected?.(message.payload);
              break;
            case 'opponent_action_locked':
              handlersRef.current.onOpponentActionLocked?.(message.payload);
              break;
            case 'momentum_reveal':
              handlersRef.current.onMomentumReveal?.(message.payload);
              break;
            case 'bot_message':
              handlersRef.current.onBotMessage?.(message.payload as { message: string; trigger: string; bot_wallet: string });
              break;
            case 'achievement_unlocked':
              handlersRef.current.onAchievementUnlocked?.(message.payload as { achievement_key: string; title: string; description: string; category: string; tier: string; badge_icon: string; badge_color: string });
              break;
            case 'error':
              console.error('Server error:', message.payload.message);
              handlersRef.current.onError?.(message.payload.message);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (manualCloseRef.current || !isMountedRef.current) return;
        console.error('❌ WebSocket error:', error);
        handlersRef.current.onError?.('Connection error');
        isConnectingRef.current = false;
        try {
          ws.close();
        } catch {}
      };

      ws.onclose = (event) => {
        if (!manualCloseRef.current) {
          console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        }
        setIsConnected(false);
        isConnectingRef.current = false;
        joinedRef.current = false;
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }

        // Only attempt reconnect if component is still mounted
        if (!manualCloseRef.current && isMountedRef.current && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/5)`);
          setTimeout(() => {
            if (isMountedRef.current) {
              reconnectAttemptsRef.current += 1;
              connectToMatch();
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= 5 && isMountedRef.current) {
          console.error('Max reconnection attempts reached');
          handlersRef.current.onError?.('Failed to connect after multiple attempts');
        }
      };

      wsRef.current = ws;

      // Fail fast if connection hangs
      connectTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING && isMountedRef.current) {
          console.error('Connection timeout after 5s');
          try {
            ws.close(4000, 'connect timeout');
          } catch {}
          isConnectingRef.current = false;
        }
      }, 5000);
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      isConnectingRef.current = false;
      if (isMountedRef.current) {
        handlersRef.current.onError?.('Failed to create WebSocket connection');
      }
    }
  }, [matchId, playerWallet, resolveWsUrl]);

  useEffect(() => {
    if (!playerWallet || !matchId) {
      console.log('Missing playerWallet or matchId, skipping connection');
      return;
    }
    
    // Mark component as mounted
    isMountedRef.current = true;
    console.log('Initiating WebSocket connection for match:', matchId, 'wallet:', playerWallet);
    
    // Small delay to handle React StrictMode double-mount
    const connectionTimer = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      console.log('Cleaning up WebSocket connection');
      isMountedRef.current = false;
      clearTimeout(connectionTimer);
      
      if (wsRef.current) {
        manualCloseRef.current = true;
        joinedRef.current = false;
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'leave_match',
            payload: { match_id: matchId, player_wallet: playerWallet },
            timestamp: Date.now(),
          }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    };
  }, [connect, matchId, playerWallet]);

  const sendMessage = useCallback((message: Omit<WSMessage, 'timestamp'>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
      }));
    } else {
      console.error('WebSocket not connected. ReadyState:', wsRef.current?.readyState);
    }
  }, []);

  const submitAction = useCallback((action: string, roundNumber: number, clientNonce: string) => {
    sendMessage({
      type: 'submit_action',
      payload: {
        match_id: matchId,
        player_wallet: playerWallet,
        action,
        round_number: roundNumber,
        client_nonce: clientNonce,
      },
    });
  }, [matchId, playerWallet, sendMessage]);

  const selectCard = useCallback((cardId: number, roundNumber: number) => {
    sendMessage({
      type: 'select_card',
      payload: {
        match_id: matchId,
        player_wallet: playerWallet,
        card_id: cardId,
        round_number: roundNumber,
      },
    });
  }, [matchId, playerWallet, sendMessage]);

  const swapCard = useCallback((newCardId: number, roundNumber: number) => {
    sendMessage({
      type: 'swap_card',
      payload: {
        match_id: matchId,
        player_wallet: playerWallet,
        new_card_id: newCardId,
        round_number: roundNumber,
      },
    });
  }, [matchId, playerWallet, sendMessage]);

  return {
    isConnected,
    submitAction,
    selectCard,
    swapCard,
  };
}