export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abilities: {
        Row: {
          ability_id: string
          config: Json
          created_at: string | null
          description: string
          effect_type: string
          name: string
          trigger_type: string
          updated_at: string | null
          usage_limit: string | null
        }
        Insert: {
          ability_id: string
          config: Json
          created_at?: string | null
          description: string
          effect_type: string
          name: string
          trigger_type: string
          updated_at?: string | null
          usage_limit?: string | null
        }
        Update: {
          ability_id?: string
          config?: Json
          created_at?: string | null
          description?: string
          effect_type?: string
          name?: string
          trigger_type?: string
          updated_at?: string | null
          usage_limit?: string | null
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string | null
          role: Database["public"]["Enums"]["admin_role"]
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          role: Database["public"]["Enums"]["admin_role"]
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_wallet_address_fkey"
            columns: ["wallet_address"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_id: number
          body: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          is_active: boolean | null
          title: string
        }
        Insert: {
          announcement_id?: number
          body: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          title: string
        }
        Update: {
          announcement_id?: number
          body?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_wallet: string
          after_data: Json | null
          before_data: Json | null
          log_id: number
          record_id: string | null
          table_name: string | null
          timestamp: string | null
        }
        Insert: {
          action: string
          admin_wallet: string
          after_data?: Json | null
          before_data?: Json | null
          log_id?: number
          record_id?: string | null
          table_name?: string | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          admin_wallet?: string
          after_data?: Json | null
          before_data?: Json | null
          log_id?: number
          record_id?: string | null
          table_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_wallet_fkey"
            columns: ["admin_wallet"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      bot_cards: {
        Row: {
          created_at: string | null
          id: number
          level: number | null
          merge_count: number | null
          template_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          level?: number | null
          merge_count?: number | null
          template_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          level?: number | null
          merge_count?: number | null
          template_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "card_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      bots: {
        Row: {
          aggression: number
          bot_id: number
          charge_bias: number
          created_at: string | null
          defense: number
          description: string | null
          difficulty: string
          enabled: boolean
          name: string
          preferred_assets: string[]
        }
        Insert: {
          aggression?: number
          bot_id?: number
          charge_bias?: number
          created_at?: string | null
          defense?: number
          description?: string | null
          difficulty: string
          enabled?: boolean
          name: string
          preferred_assets?: string[]
        }
        Update: {
          aggression?: number
          bot_id?: number
          charge_bias?: number
          created_at?: string | null
          defense?: number
          description?: string | null
          difficulty?: string
          enabled?: boolean
          name?: string
          preferred_assets?: string[]
        }
        Relationships: []
      }
      card_templates: {
        Row: {
          ability_id: string
          asset: Database["public"]["Enums"]["card_asset"]
          attack_affinity: number
          base: number
          base_defense: number | null
          base_focus: number | null
          base_power: number | null
          charge_affinity: number | null
          created_at: string | null
          defense_affinity: number
          image_url: string | null
          is_ai_card: boolean | null
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
          template_id: number
          updated_at: string | null
          volatility_sensitivity: number
        }
        Insert: {
          ability_id: string
          asset: Database["public"]["Enums"]["card_asset"]
          attack_affinity: number
          base: number
          base_defense?: number | null
          base_focus?: number | null
          base_power?: number | null
          charge_affinity?: number | null
          created_at?: string | null
          defense_affinity: number
          image_url?: string | null
          is_ai_card?: boolean | null
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
          template_id?: number
          updated_at?: string | null
          volatility_sensitivity: number
        }
        Update: {
          ability_id?: string
          asset?: Database["public"]["Enums"]["card_asset"]
          attack_affinity?: number
          base?: number
          base_defense?: number | null
          base_focus?: number | null
          base_power?: number | null
          charge_affinity?: number | null
          created_at?: string | null
          defense_affinity?: number
          image_url?: string | null
          is_ai_card?: boolean | null
          name?: string
          rarity?: Database["public"]["Enums"]["rarity"]
          template_id?: number
          updated_at?: string | null
          volatility_sensitivity?: number
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          card_1_id: number | null
          card_2_id: number | null
          card_3_id: number | null
          event_id: number
          final_rank: number | null
          id: number
          joined_at: string | null
          player_wallet: string
          prize_won: number | null
          total_damage_done: number
          total_damage_received: number
          total_draws: number
          total_losses: number
          total_wins: number
          war_points: number | null
        }
        Insert: {
          card_1_id?: number | null
          card_2_id?: number | null
          card_3_id?: number | null
          event_id: number
          final_rank?: number | null
          id?: number
          joined_at?: string | null
          player_wallet: string
          prize_won?: number | null
          total_damage_done?: number
          total_damage_received?: number
          total_draws?: number
          total_losses?: number
          total_wins?: number
          war_points?: number | null
        }
        Update: {
          card_1_id?: number | null
          card_2_id?: number | null
          card_3_id?: number | null
          event_id?: number
          final_rank?: number | null
          id?: number
          joined_at?: string | null
          player_wallet?: string
          prize_won?: number | null
          total_damage_done?: number
          total_damage_received?: number
          total_draws?: number
          total_losses?: number
          total_wins?: number
          war_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_card_1_id_fkey"
            columns: ["card_1_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_card_2_id_fkey"
            columns: ["card_2_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_card_3_id_fkey"
            columns: ["card_3_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_participants_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          current_players: number | null
          ends_at: string | null
          entry_fee: number
          event_id: number
          event_name: string
          first_place_percent: number | null
          max_players: number
          on_chain_id: number | null
          prize_pool: number | null
          second_place_percent: number | null
          sp_reward: number
          starts_at: string
          status: Database["public"]["Enums"]["event_status"] | null
          third_place_percent: number | null
          total_rounds: number
        }
        Insert: {
          created_at?: string | null
          current_players?: number | null
          ends_at?: string | null
          entry_fee: number
          event_id?: number
          event_name: string
          first_place_percent?: number | null
          max_players: number
          on_chain_id?: number | null
          prize_pool?: number | null
          second_place_percent?: number | null
          sp_reward?: number
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"] | null
          third_place_percent?: number | null
          total_rounds?: number
        }
        Update: {
          created_at?: string | null
          current_players?: number | null
          ends_at?: string | null
          entry_fee?: number
          event_id?: number
          event_name?: string
          first_place_percent?: number | null
          max_players?: number
          on_chain_id?: number | null
          prize_pool?: number | null
          second_place_percent?: number | null
          sp_reward?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"] | null
          third_place_percent?: number | null
          total_rounds?: number
        }
        Relationships: []
      }
      market_items: {
        Row: {
          card_weights: Json | null
          cards_granted: number | null
          created_at: string | null
          description: string | null
          guaranteed_cards: Json | null
          image_url: string | null
          is_active: boolean | null
          item_id: number
          item_type: string
          name: string
          per_wallet_limit: number | null
          possible_cards: Json | null
          price_strk: number
          reveal_animation: boolean | null
        }
        Insert: {
          card_weights?: Json | null
          cards_granted?: number | null
          created_at?: string | null
          description?: string | null
          guaranteed_cards?: Json | null
          image_url?: string | null
          is_active?: boolean | null
          item_id?: number
          item_type: string
          name: string
          per_wallet_limit?: number | null
          possible_cards?: Json | null
          price_strk: number
          reveal_animation?: boolean | null
        }
        Update: {
          card_weights?: Json | null
          cards_granted?: number | null
          created_at?: string | null
          description?: string | null
          guaranteed_cards?: Json | null
          image_url?: string | null
          is_active?: boolean | null
          item_id?: number
          item_type?: string
          name?: string
          per_wallet_limit?: number | null
          possible_cards?: Json | null
          price_strk?: number
          reveal_animation?: boolean | null
        }
        Relationships: []
      }
      match_actions: {
        Row: {
          action: Database["public"]["Enums"]["player_action"]
          action_timestamp: string | null
          bot_card_id: number | null
          card_id: number | null
          client_nonce: string
          id: number
          match_id: number
          player_wallet: string
          round_number: number
        }
        Insert: {
          action: Database["public"]["Enums"]["player_action"]
          action_timestamp?: string | null
          bot_card_id?: number | null
          card_id?: number | null
          client_nonce: string
          id?: number
          match_id: number
          player_wallet: string
          round_number: number
        }
        Update: {
          action?: Database["public"]["Enums"]["player_action"]
          action_timestamp?: string | null
          bot_card_id?: number | null
          card_id?: number | null
          client_nonce?: string
          id?: number
          match_id?: number
          player_wallet?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_actions_bot_card_id_fkey"
            columns: ["bot_card_id"]
            isOneToOne: false
            referencedRelation: "bot_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_actions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_actions_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      match_players: {
        Row: {
          active_card_id: number | null
          bot_active_card_id: number | null
          bot_card_1_id: number | null
          bot_card_2_id: number | null
          bot_card_3_id: number | null
          bot_charged_card_id: number | null
          card_1_id: number | null
          card_2_id: number | null
          card_3_id: number | null
          charge_armed: boolean | null
          charge_used: boolean | null
          charged_applies_round: number | null
          charged_card_id: number | null
          id: number
          match_id: number
          player_wallet: string
          swaps_used: number | null
        }
        Insert: {
          active_card_id?: number | null
          bot_active_card_id?: number | null
          bot_card_1_id?: number | null
          bot_card_2_id?: number | null
          bot_card_3_id?: number | null
          bot_charged_card_id?: number | null
          card_1_id?: number | null
          card_2_id?: number | null
          card_3_id?: number | null
          charge_armed?: boolean | null
          charge_used?: boolean | null
          charged_applies_round?: number | null
          charged_card_id?: number | null
          id?: number
          match_id: number
          player_wallet: string
          swaps_used?: number | null
        }
        Update: {
          active_card_id?: number | null
          bot_active_card_id?: number | null
          bot_card_1_id?: number | null
          bot_card_2_id?: number | null
          bot_card_3_id?: number | null
          bot_charged_card_id?: number | null
          card_1_id?: number | null
          card_2_id?: number | null
          card_3_id?: number | null
          charge_armed?: boolean | null
          charge_used?: boolean | null
          charged_applies_round?: number | null
          charged_card_id?: number | null
          id?: number
          match_id?: number
          player_wallet?: string
          swaps_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_players_active_card_id_fkey"
            columns: ["active_card_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_bot_active_card_id_fkey"
            columns: ["bot_active_card_id"]
            isOneToOne: false
            referencedRelation: "bot_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_bot_card_1_id_fkey"
            columns: ["bot_card_1_id"]
            isOneToOne: false
            referencedRelation: "bot_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_bot_card_2_id_fkey"
            columns: ["bot_card_2_id"]
            isOneToOne: false
            referencedRelation: "bot_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_bot_card_3_id_fkey"
            columns: ["bot_card_3_id"]
            isOneToOne: false
            referencedRelation: "bot_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_bot_charged_card_id_fkey"
            columns: ["bot_charged_card_id"]
            isOneToOne: false
            referencedRelation: "bot_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_card_1_id_fkey"
            columns: ["card_1_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_card_2_id_fkey"
            columns: ["card_2_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_card_3_id_fkey"
            columns: ["card_3_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_charged_card_id_fkey"
            columns: ["charged_card_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_players_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      match_rounds: {
        Row: {
          btc_snapshot: number | null
          doge_snapshot: number | null
          eth_snapshot: number | null
          id: number
          match_id: number
          p1_ability_triggered: boolean | null
          p1_action: Database["public"]["Enums"]["player_action"] | null
          p2_ability_triggered: boolean | null
          p2_action: Database["public"]["Enums"]["player_action"] | null
          round_ended_at: string | null
          round_number: number
          round_started_at: string | null
          sol_snapshot: number | null
          strk_snapshot: number | null
          winner: string | null
        }
        Insert: {
          btc_snapshot?: number | null
          doge_snapshot?: number | null
          eth_snapshot?: number | null
          id?: number
          match_id: number
          p1_ability_triggered?: boolean | null
          p1_action?: Database["public"]["Enums"]["player_action"] | null
          p2_ability_triggered?: boolean | null
          p2_action?: Database["public"]["Enums"]["player_action"] | null
          round_ended_at?: string | null
          round_number: number
          round_started_at?: string | null
          sol_snapshot?: number | null
          strk_snapshot?: number | null
          winner?: string | null
        }
        Update: {
          btc_snapshot?: number | null
          doge_snapshot?: number | null
          eth_snapshot?: number | null
          id?: number
          match_id?: number
          p1_ability_triggered?: boolean | null
          p1_action?: Database["public"]["Enums"]["player_action"] | null
          p2_ability_triggered?: boolean | null
          p2_action?: Database["public"]["Enums"]["player_action"] | null
          round_ended_at?: string | null
          round_number?: number
          round_started_at?: string | null
          sol_snapshot?: number | null
          strk_snapshot?: number | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_rounds_winner_fkey"
            columns: ["winner"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      matches: {
        Row: {
          bot_id: number | null
          created_at: string | null
          current_round: number | null
          ended_at: string | null
          event_context_id: number | null
          match_id: number
          mode: Database["public"]["Enums"]["match_mode"]
          on_chain_id: number | null
          p1_rounds_won: number | null
          p2_rounds_won: number | null
          player_1: string
          player_2: string
          room_context_id: number | null
          room_context_player_wallet: string | null
          stake_tier: Database["public"]["Enums"]["stake_tier"] | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          total_rounds: number
          total_stake: number | null
          transcript_hash: string | null
          winner: string | null
        }
        Insert: {
          bot_id?: number | null
          created_at?: string | null
          current_round?: number | null
          ended_at?: string | null
          event_context_id?: number | null
          match_id?: number
          mode: Database["public"]["Enums"]["match_mode"]
          on_chain_id?: number | null
          p1_rounds_won?: number | null
          p2_rounds_won?: number | null
          player_1: string
          player_2: string
          room_context_id?: number | null
          room_context_player_wallet?: string | null
          stake_tier?: Database["public"]["Enums"]["stake_tier"] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          total_rounds: number
          total_stake?: number | null
          transcript_hash?: string | null
          winner?: string | null
        }
        Update: {
          bot_id?: number | null
          created_at?: string | null
          current_round?: number | null
          ended_at?: string | null
          event_context_id?: number | null
          match_id?: number
          mode?: Database["public"]["Enums"]["match_mode"]
          on_chain_id?: number | null
          p1_rounds_won?: number | null
          p2_rounds_won?: number | null
          player_1?: string
          player_2?: string
          room_context_id?: number | null
          room_context_player_wallet?: string | null
          stake_tier?: Database["public"]["Enums"]["stake_tier"] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          total_rounds?: number
          total_stake?: number | null
          transcript_hash?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["bot_id"]
          },
          {
            foreignKeyName: "matches_event_context_id_fkey"
            columns: ["event_context_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "matches_player_1_fkey"
            columns: ["player_1"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "matches_player_2_fkey"
            columns: ["player_2"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "matches_room_context_id_fkey"
            columns: ["room_context_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "matches_room_context_player_wallet_fkey"
            columns: ["room_context_player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "matches_winner_fkey"
            columns: ["winner"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      oracle_snapshots: {
        Row: {
          asset: Database["public"]["Enums"]["card_asset"]
          created_at: string | null
          decimals: number
          id: number
          match_id: number | null
          price: number
          round_number: number | null
          staleness_seconds: number | null
          timestamp: string
        }
        Insert: {
          asset: Database["public"]["Enums"]["card_asset"]
          created_at?: string | null
          decimals: number
          id?: number
          match_id?: number | null
          price: number
          round_number?: number | null
          staleness_seconds?: number | null
          timestamp: string
        }
        Update: {
          asset?: Database["public"]["Enums"]["card_asset"]
          created_at?: string | null
          decimals?: number
          id?: number
          match_id?: number | null
          price?: number
          round_number?: number | null
          staleness_seconds?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_snapshots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      player_cards: {
        Row: {
          acquired_at: string | null
          id: number
          is_ai_card: boolean | null
          level: number | null
          merge_count: number | null
          owner_wallet: string
          template_id: number
        }
        Insert: {
          acquired_at?: string | null
          id?: number
          is_ai_card?: boolean | null
          level?: number | null
          merge_count?: number | null
          owner_wallet: string
          template_id: number
        }
        Update: {
          acquired_at?: string | null
          id?: number
          is_ai_card?: boolean | null
          level?: number | null
          merge_count?: number | null
          owner_wallet?: string
          template_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_cards_owner_wallet_fkey"
            columns: ["owner_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      player_inbox: {
        Row: {
          body: string
          category: string
          created_at: string
          is_read: boolean
          message_id: number
          player_wallet: string
          related_report_id: number | null
          related_room_id: number | null
          subject: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          is_read?: boolean
          message_id?: number
          player_wallet: string
          related_report_id?: number | null
          related_room_id?: number | null
          subject?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          is_read?: boolean
          message_id?: number
          player_wallet?: string
          related_report_id?: number | null
          related_room_id?: number | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_inbox_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_inbox_related_report_id_fkey"
            columns: ["related_report_id"]
            isOneToOne: false
            referencedRelation: "player_reports"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "player_inbox_related_room_id_fkey"
            columns: ["related_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
        ]
      }
      player_reports: {
        Row: {
          admin_wallet: string | null
          created_at: string | null
          details: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          related_sanction_id: number | null
          report_id: number
          reported_wallet: string
          reporter_wallet: string
          resolution_notes: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string | null
        }
        Insert: {
          admin_wallet?: string | null
          created_at?: string | null
          details?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          related_sanction_id?: number | null
          report_id?: number
          reported_wallet: string
          reporter_wallet: string
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string | null
        }
        Update: {
          admin_wallet?: string | null
          created_at?: string | null
          details?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          related_sanction_id?: number | null
          report_id?: number
          reported_wallet?: string
          reporter_wallet?: string
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_reports_admin_wallet_fkey"
            columns: ["admin_wallet"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_reports_reported_wallet_fkey"
            columns: ["reported_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_reports_reporter_wallet_fkey"
            columns: ["reporter_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      player_sanctions: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          petition_created_at: string | null
          petition_status: Database["public"]["Enums"]["petition_status"]
          petition_text: string | null
          player_wallet: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sanction_id: number
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          sp_penalty: number
          status: Database["public"]["Enums"]["sanction_status"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          petition_created_at?: string | null
          petition_status?: Database["public"]["Enums"]["petition_status"]
          petition_text?: string | null
          player_wallet: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sanction_id?: number
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          sp_penalty?: number
          status?: Database["public"]["Enums"]["sanction_status"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          petition_created_at?: string | null
          petition_status?: Database["public"]["Enums"]["petition_status"]
          petition_text?: string | null
          player_wallet?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sanction_id?: number
          sanction_type?: Database["public"]["Enums"]["sanction_type"]
          sp_penalty?: number
          status?: Database["public"]["Enums"]["sanction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "player_sanctions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_sanctions_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_sanctions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string | null
          losses: number | null
          mmr: number | null
          stark_points: number
          strk_balance: number | null
          total_xp: number | null
          updated_at: string | null
          username: string | null
          wallet_address: string
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          losses?: number | null
          mmr?: number | null
          stark_points?: number
          strk_balance?: number | null
          total_xp?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address: string
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          losses?: number | null
          mmr?: number | null
          stark_points?: number
          strk_balance?: number | null
          total_xp?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string
          wins?: number | null
        }
        Relationships: []
      }
      purchase_history: {
        Row: {
          amount_paid: number
          cards_received: Json
          item_id: number
          player_wallet: string
          purchase_id: number
          purchased_at: string | null
          tx_hash: string
        }
        Insert: {
          amount_paid: number
          cards_received: Json
          item_id: number
          player_wallet: string
          purchase_id?: number
          purchased_at?: string | null
          tx_hash: string
        }
        Update: {
          amount_paid?: number
          cards_received?: Json
          item_id?: number
          player_wallet?: string
          purchase_id?: number
          purchased_at?: string | null
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "market_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_history_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      ranked_queue: {
        Row: {
          card_1_id: number
          card_2_id: number
          card_3_id: number
          created_at: string | null
          event_id: number | null
          player_wallet: string
          queue_id: number
          room_context_id: number | null
          stake_tier: Database["public"]["Enums"]["stake_tier"] | null
          total_rounds: number
        }
        Insert: {
          card_1_id: number
          card_2_id: number
          card_3_id: number
          created_at?: string | null
          event_id?: number | null
          player_wallet: string
          queue_id?: number
          room_context_id?: number | null
          stake_tier?: Database["public"]["Enums"]["stake_tier"] | null
          total_rounds: number
        }
        Update: {
          card_1_id?: number
          card_2_id?: number
          card_3_id?: number
          created_at?: string | null
          event_id?: number | null
          player_wallet?: string
          queue_id?: number
          room_context_id?: number | null
          stake_tier?: Database["public"]["Enums"]["stake_tier"] | null
          total_rounds?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranked_queue_card_1_id_fkey"
            columns: ["card_1_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_queue_card_2_id_fkey"
            columns: ["card_2_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_queue_card_3_id_fkey"
            columns: ["card_3_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "ranked_queue_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "ranked_queue_room_context_id_fkey"
            columns: ["room_context_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
        ]
      }
      room_disputes: {
        Row: {
          admin_reply: string | null
          admin_wallet: string | null
          created_at: string
          dispute_id: number
          message: string
          player_wallet: string
          report_id: number | null
          room_code: string
          room_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          admin_wallet?: string | null
          created_at?: string
          dispute_id?: number
          message: string
          player_wallet: string
          report_id?: number | null
          room_code: string
          room_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          admin_wallet?: string | null
          created_at?: string
          dispute_id?: number
          message?: string
          player_wallet?: string
          report_id?: number | null
          room_code?: string
          room_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_disputes_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "room_disputes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "player_reports"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "room_disputes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
        ]
      }
      room_fixtures: {
        Row: {
          created_at: string | null
          fixture_id: number
          match_id: number | null
          player_a: string
          player_b: string | null
          room_id: number
          round_number: number
          status: string
          winner_wallet: string | null
        }
        Insert: {
          created_at?: string | null
          fixture_id?: number
          match_id?: number | null
          player_a: string
          player_b?: string | null
          room_id: number
          round_number: number
          status?: string
          winner_wallet?: string | null
        }
        Update: {
          created_at?: string | null
          fixture_id?: number
          match_id?: number | null
          player_a?: string
          player_b?: string | null
          room_id?: number
          round_number?: number
          status?: string
          winner_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_fixtures_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "room_fixtures_player_a_fkey"
            columns: ["player_a"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "room_fixtures_player_b_fkey"
            columns: ["player_b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "room_fixtures_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_fixtures_winner_wallet_fkey"
            columns: ["winner_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      room_members: {
        Row: {
          card_1_id: number | null
          card_2_id: number | null
          card_3_id: number | null
          fee_paid: number
          id: number
          joined_at: string | null
          player_wallet: string
          prize_won: number
          room_id: number
          status: Database["public"]["Enums"]["room_member_status"]
        }
        Insert: {
          card_1_id?: number | null
          card_2_id?: number | null
          card_3_id?: number | null
          fee_paid?: number
          id?: number
          joined_at?: string | null
          player_wallet: string
          prize_won?: number
          room_id: number
          status?: Database["public"]["Enums"]["room_member_status"]
        }
        Update: {
          card_1_id?: number | null
          card_2_id?: number | null
          card_3_id?: number | null
          fee_paid?: number
          id?: number
          joined_at?: string | null
          player_wallet?: string
          prize_won?: number
          room_id?: number
          status?: Database["public"]["Enums"]["room_member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "room_members_card_1_id_fkey"
            columns: ["card_1_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_card_2_id_fkey"
            columns: ["card_2_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_card_3_id_fkey"
            columns: ["card_3_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
        ]
      }
      room_standings: {
        Row: {
          draws: number
          id: number
          losses: number
          player_wallet: string
          points: number
          room_id: number
          wins: number
        }
        Insert: {
          draws?: number
          id?: number
          losses?: number
          player_wallet: string
          points?: number
          room_id: number
          wins?: number
        }
        Update: {
          draws?: number
          id?: number
          losses?: number
          player_wallet?: string
          points?: number
          room_id?: number
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_standings_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "room_standings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string | null
          current_players: number
          decay_at: string | null
          destroy_after: string | null
          ends_at: string | null
          has_forfeit: boolean
          host_wallet: string
          matches_per_player: number
          max_players: number
          prize_pool: number
          room_code: string
          room_id: number
          settled_at: string | null
          stake_fee: number
          starts_at: string | null
          status: Database["public"]["Enums"]["room_status"]
          timer_hours: number
          total_rounds: number
          treasury_fee: string | null
          visibility: Database["public"]["Enums"]["room_visibility"]
          winner_payout: string | null
        }
        Insert: {
          created_at?: string | null
          current_players?: number
          decay_at?: string | null
          destroy_after?: string | null
          ends_at?: string | null
          has_forfeit?: boolean
          host_wallet: string
          matches_per_player?: number
          max_players: number
          prize_pool?: number
          room_code: string
          room_id?: number
          settled_at?: string | null
          stake_fee: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          timer_hours: number
          total_rounds: number
          treasury_fee?: string | null
          visibility?: Database["public"]["Enums"]["room_visibility"]
          winner_payout?: string | null
        }
        Update: {
          created_at?: string | null
          current_players?: number
          decay_at?: string | null
          destroy_after?: string | null
          ends_at?: string | null
          has_forfeit?: boolean
          host_wallet?: string
          matches_per_player?: number
          max_players?: number
          prize_pool?: number
          room_code?: string
          room_id?: number
          settled_at?: string | null
          stake_fee?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          timer_hours?: number
          total_rounds?: number
          treasury_fee?: string | null
          visibility?: Database["public"]["Enums"]["room_visibility"]
          winner_payout?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_wallet_fkey"
            columns: ["host_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          player_wallet: string
          related_id: number | null
          status: string | null
          tx_hash: string | null
          tx_id: number
          tx_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          player_wallet: string
          related_id?: number | null
          status?: string | null
          tx_hash?: string | null
          tx_id?: number
          tx_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          player_wallet?: string
          related_id?: number | null
          status?: string | null
          tx_hash?: string | null
          tx_id?: number
          tx_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      achievement_definitions: {
        Row: {
          key: string
          title: string
          description: string
          category: string
          tier: string
          badge_icon: string
          badge_color: string
          xp_reward: number
          sp_reward: number
          created_at: string | null
        }
        Insert: {
          key: string
          title: string
          description: string
          category: string
          tier: string
          badge_icon: string
          badge_color: string
          xp_reward?: number
          sp_reward?: number
          created_at?: string | null
        }
        Update: {
          key?: string
          title?: string
          description?: string
          category?: string
          tier?: string
          badge_icon?: string
          badge_color?: string
          xp_reward?: number
          sp_reward?: number
          created_at?: string | null
        }
        Relationships: []
      }
      player_achievements: {
        Row: {
          id: number
          player_wallet: string
          achievement_key: string
          unlocked_at: string
        }
        Insert: {
          id?: number
          player_wallet: string
          achievement_key: string
          unlocked_at?: string
        }
        Update: {
          id?: number
          player_wallet?: string
          achievement_key?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_player_wallet_fkey"
            columns: ["player_wallet"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "player_achievements_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_match_winner: {
        Args: { match_id_param: number }
        Returns: string
      }
      get_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          losses: number
          stark_points: number
          total_xp: number
          username: string
          wallet_address: string
          win_rate: number
          wins: number
        }[]
      }
      get_player_stats: {
        Args: { player_wallet: string }
        Returns: {
          cards_owned: number
          losses: number
          stark_points: number
          strk_balance: number
          total_events_joined: number
          total_matches: number
          total_xp: number
          win_rate: number
          wins: number
        }[]
      }
      increment_player_balance: {
        Args: { p_amount: string; p_wallet: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      admin_role: "SuperAdmin" | "Moderator" | "Analyst"
      card_asset: "BTC" | "ETH" | "STRK" | "SOL" | "DOGE"
      event_status: "Open" | "InProgress" | "Completed" | "Cancelled"
      match_mode: "VsAI" | "Ranked1v1" | "WarZone" | "Room" | "Challenge"
      match_status:
        | "WaitingForOpponent"
        | "InProgress"
        | "PausedOracle"
        | "Completed"
        | "Cancelled"
      petition_status: "None" | "Pending" | "Approved" | "Rejected"
      player_action: "Attack" | "Defend" | "Charge" | "UseAbility" | "NoAction"
      rarity: "Common" | "Rare" | "Epic" | "Legendary"
      report_reason:
        | "Cheating"
        | "Stalling"
        | "Harassment"
        | "BugExploit"
        | "Other"
      report_status: "Open" | "Reviewed" | "Actioned" | "Closed"
      room_format: "League" | "Knockout"
      room_member_status: "Active" | "Quit" | "Eliminated" | "Winner"
      room_status: "Open" | "InProgress" | "Completed" | "Cancelled" | "Expired"
      room_visibility: "Public" | "Private"
      sanction_status: "Active" | "Expired" | "Revoked"
      sanction_type: "Suspension" | "PermanentBan" | "TournamentBan"
      stake_tier: "Tier10" | "Tier20" | "Tier100"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["SuperAdmin", "Moderator", "Analyst"],
      card_asset: ["BTC", "ETH", "STRK", "SOL", "DOGE"],
      event_status: ["Open", "InProgress", "Completed", "Cancelled"],
      match_mode: ["VsAI", "Ranked1v1", "WarZone", "Room", "Challenge"],
      match_status: [
        "WaitingForOpponent",
        "InProgress",
        "PausedOracle",
        "Completed",
        "Cancelled",
      ],
      petition_status: ["None", "Pending", "Approved", "Rejected"],
      player_action: ["Attack", "Defend", "Charge", "UseAbility", "NoAction"],
      rarity: ["Common", "Rare", "Epic", "Legendary"],
      report_reason: [
        "Cheating",
        "Stalling",
        "Harassment",
        "BugExploit",
        "Other",
      ],
      report_status: ["Open", "Reviewed", "Actioned", "Closed"],
      room_format: ["League", "Knockout"],
      room_member_status: ["Active", "Quit", "Eliminated", "Winner"],
      room_status: ["Open", "InProgress", "Completed", "Cancelled", "Expired"],
      room_visibility: ["Public", "Private"],
      sanction_status: ["Active", "Expired", "Revoked"],
      sanction_type: ["Suspension", "PermanentBan", "TournamentBan"],
      stake_tier: ["Tier10", "Tier20", "Tier100"],
    },
  },
} as const
