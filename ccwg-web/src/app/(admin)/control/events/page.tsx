'use client';

import { useState, useEffect } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { Plus, Calendar, Users, Trophy, X } from 'lucide-react';
import type { GameEvent } from '@/src/types/database';
import { formatStrk, strkToWei } from '@/src/lib/cartridge/utils';
import { EventForm } from '@/src/components/admin/EventForm';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/control/events');
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to cancel this event?')) return;

    try {
      await fetch(`/api/control/events/${eventId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetchEvents();
    } catch (error) {
      console.error('Failed to cancel event:', error);
    }
  };

  const handleCompleteEvent = async (eventId: number) => {
    if (!confirm('Mark this event as completed and award SP?')) return;

    try {
      await fetch(`/api/control/events/${eventId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetchEvents();
    } catch (error) {
      console.error('Failed to complete event:', error);
    }
  };

  const handleCreateEvent = async (formData: {
    event_name: string;
    entry_fee: string;
    max_players: number;
    total_rounds: number;
    sp_reward: number;
    first_place_percent: number;
    second_place_percent: number;
    third_place_percent: number;
    starts_at: string;
    ends_at: string;
  }) => {
    try {
      // Convert human-readable STRK amount (e.g. "100") to wei (smallest unit,
      // 18 decimals) so the DB, on-chain contract, and display all agree.
      const entryFeeWei = strkToWei(formData.entry_fee).toString();

      const response = await fetch('/api/control/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          entry_fee: entryFeeWei,
          starts_at: new Date(formData.starts_at).toISOString(),
          ends_at: new Date(formData.ends_at).toISOString(),
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }
      
      setShowForm(false);
      await fetchEvents();
    } catch (error) {
      console.error('Failed to create event:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-green-900 text-green-300';
      case 'InProgress':
        return 'bg-blue-900 text-blue-300';
      case 'Completed':
        return 'bg-gray-700 text-gray-400';
      case 'Cancelled':
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Events Management</h1>
              <p className="text-gray-400">Manage WarZone tournaments and events</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </button>
        </div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {events.map(event => (
            <div
              key={event.event_id}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{event.event_name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                </div>
                {event.status === 'Open' && (
                  <button
                    onClick={() => handleCancelEvent(event.event_id)}
                    className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                    title="Cancel Event"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                )}
                {event.status !== 'Completed' && event.status !== 'Cancelled' && (
                  <button
                    onClick={() => handleCompleteEvent(event.event_id)}
                    className="p-2 hover:bg-green-900/50 rounded-lg transition-colors"
                    title="Complete Event"
                  >
                    <Trophy className="w-4 h-4 text-green-400" />
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400 text-xs">Players</span>
                  </div>
                  <p className="text-white font-bold">
                    {event.current_players}/{event.max_players}
                  </p>
                </div>

                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-gray-400 text-xs">Prize Pool</span>
                  </div>
                  <p className="text-yellow-400 font-bold">
                    {formatStrk(event.prize_pool)} STRK
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Entry Fee:</span>
                  <span className="text-purple-400 font-semibold">
                    {formatStrk(event.entry_fee)} STRK
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Prize Split:</span>
                  <span className="text-white font-medium">
                    {event.first_place_percent / 100}% / {event.second_place_percent / 100}% / {event.third_place_percent / 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Rounds:</span>
                  <span className="text-white font-medium">{event.total_rounds}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Starts At:</span>
                  <span className="text-white">
                    {new Date(event.starts_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Ends At:</span>
                  <span className="text-white">
                    {event.ends_at ? new Date(event.ends_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {event.status === 'Open' && event.current_players >= 3 && (
                <button className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors">
                  Start Event
                </button>
              )}
            </div>
          ))}
        </div>

        {events.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400">
            No events created yet. Create your first event!
          </div>
        )}

        {showForm && (
          <EventForm
            onSubmit={handleCreateEvent}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
}
