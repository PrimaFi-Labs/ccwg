'use client';

import { useEffect, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { Mail, MailOpen, ArrowLeft, Inbox, AlertCircle, DoorOpen, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerInboxMessage, InboxCategory } from '@/src/types/database';

const CATEGORY_META: Record<InboxCategory, { label: string; color: string; icon: React.ElementType }> = {
  system:        { label: 'System',   color: 'var(--accent-primary)',  icon: Shield },
  dispute_reply: { label: 'Dispute',  color: '#f87171',                icon: AlertCircle },
  room:          { label: 'Room',     color: '#f59e0b',                icon: DoorOpen },
};

function getCategoryMeta(cat: InboxCategory) {
  return CATEGORY_META[cat] ?? { label: cat, color: 'var(--text-muted)', icon: Mail };
}

function formatDate(str: string) {
  const d = new Date(str);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function InboxPage() {
  const { isConnected } = useAccount();
  const [messages, setMessages] = useState<PlayerInboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState<PlayerInboxMessage | null>(null);

  useEffect(() => {
    if (isConnected) fetchInbox();
  }, [isConnected]);

  const fetchInbox = async () => {
    try {
      const res = await fetch('/api/inbox', { cache: 'no-store' });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: number) => {
    await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: id }),
    });
  };

  const openMessage = async (msg: PlayerInboxMessage) => {
    setSelectedMsg(msg);
    if (!msg.is_read) {
      await markRead(msg.message_id);
      setMessages((prev) =>
        prev.map((m) => (m.message_id === msg.message_id ? { ...m, is_read: true } : m))
      );
    }
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-center p-12 rounded-2xl border overflow-hidden max-w-sm w-full"
          style={{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-accent)',
            boxShadow: '0 0 60px var(--hud-glow)',
          }}
        >
          {/* scan-line sweep */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, var(--accent-primary) 2px, var(--accent-primary) 3px)',
              animation: 'pulse 4s ease-in-out infinite',
            }}
          />

          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-primary-dim)', boxShadow: '0 0 30px var(--accent-primary-glow)' }}
          >
            <Inbox className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
          </motion.div>

          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Comms Offline</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Connect your wallet to access your inbox
          </p>
          <ConnectWallet />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-widest uppercase text-[var(--text-primary)]">
              Inbox
            </h1>
            <p className="text-xs font-tactical text-[var(--text-muted)] tracking-widest uppercase mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded font-display text-xs font-bold"
              style={{
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.4)',
                color: '#f87171',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] pulse-glow" />
              {unreadCount}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {selectedMsg ? (
            /* ─── Message detail ─── */
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <button
                onClick={() => setSelectedMsg(null)}
                className="flex items-center gap-2 text-xs font-tactical font-semibold tracking-widest uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Inbox
              </button>

              <div
                className="rounded-2xl border p-6 md:p-8 space-y-5"
                style={{
                  background: 'var(--bg-panel)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderColor: getCategoryMeta(selectedMsg.category).color,
                  boxShadow: `0 0 30px ${getCategoryMeta(selectedMsg.category).color}25`,
                }}
              >
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const meta = getCategoryMeta(selectedMsg.category);
                    const Icon = meta.icon;
                    return (
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-display font-bold tracking-wider uppercase"
                        style={{
                          color: meta.color,
                          background: `${meta.color}18`,
                          border: `1px solid ${meta.color}40`,
                        }}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(selectedMsg.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Subject */}
                <h2 className="font-display text-xl md:text-2xl font-black text-[var(--text-primary)] leading-tight">
                  {selectedMsg.subject || 'No Subject'}
                </h2>

                {/* Divider */}
                <div className="h-px" style={{ background: 'var(--border-base)' }} />

                {/* Body */}
                <div className="font-sans text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                  {selectedMsg.body}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ─── Message list ─── */
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl h-20 animate-pulse"
                    style={{ background: 'var(--bg-panel)' }}
                  />
                ))
              ) : messages.length === 0 ? (
                <div
                  className="rounded-2xl border p-16 text-center"
                  style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)' }}
                >
                  <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm text-[var(--text-muted)]">No messages yet.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const meta = getCategoryMeta(msg.category);
                  const Icon = msg.is_read ? MailOpen : Mail;
                  return (
                    <motion.button
                      key={msg.message_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => openMessage(msg)}
                      className="w-full text-left rounded-xl border p-4 transition-all duration-200 group"
                      style={{
                        background: msg.is_read ? 'var(--bg-panel)' : `${meta.color}08`,
                        borderColor: msg.is_read ? 'var(--border-base)' : `${meta.color}40`,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${meta.color}20`;
                        (e.currentTarget as HTMLElement).style.borderColor = `${meta.color}70`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '';
                        (e.currentTarget as HTMLElement).style.borderColor = msg.is_read ? 'var(--border-base)' : `${meta.color}40`;
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon with category color */}
                        <div
                          className="shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            background: `${meta.color}15`,
                            border: `1px solid ${meta.color}30`,
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: meta.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span
                              className="font-tactical font-semibold text-sm truncate"
                              style={{ color: msg.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                            >
                              {msg.subject || 'No Subject'}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {!msg.is_read && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full pulse-cyan"
                                  style={{ background: meta.color }}
                                />
                              )}
                              <span className="text-[11px] text-[var(--text-muted)]">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-display font-bold tracking-wider uppercase"
                              style={{ color: meta.color, background: `${meta.color}15` }}
                            >
                              {meta.label}
                            </span>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {msg.body.slice(0, 80)}{msg.body.length > 80 ? '…' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


