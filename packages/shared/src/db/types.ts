// Generated placeholder; run `supabase gen types typescript --local > packages/shared/src/db/types.ts`
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      market_state: {
        Row: {
          market_id: string;
          post_counts: number | null;
          probabilities: Json;
          updated_at: string;
        };
        Insert: {
          market_id: string;
          post_counts?: number | null;
          probabilities: Json;
          updated_at?: string;
        };
        Update: {
          market_id?: string;
          post_counts?: number | null;
          probabilities?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_state_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: true;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          }
        ];
      };
      market_x_rules: {
        Row: {
          created_at: string;
          id: string;
          market_id: string;
          rule: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          market_id: string;
          rule: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          market_id?: string;
          rule?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_x_rules_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          }
        ];
      };
      markets: {
        Row: {
          created_at: string;
          id: string;
          normalized_question: string | null;
          question: string;
          status: string;
          total_posts_processed: number | null;
          x_rule_templates: Json | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          normalized_question?: string | null;
          question: string;
          status?: string;
          total_posts_processed?: number | null;
          x_rule_templates?: Json | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          normalized_question?: string | null;
          question?: string;
          status?: string;
          total_posts_processed?: number | null;
          x_rule_templates?: Json | null;
        };
        Relationships: [];
      };
      outcomes: {
        Row: {
          cumulative_oppose: number | null;
          cumulative_support: number | null;
          current_probability: number | null;
          id: string;
          label: string;
          market_id: string;
          outcome_id: string;
          post_count: number | null;
        };
        Insert: {
          cumulative_oppose?: number | null;
          cumulative_support?: number | null;
          current_probability?: number | null;
          id?: string;
          label: string;
          market_id: string;
          outcome_id: string;
          post_count?: number | null;
        };
        Update: {
          cumulative_oppose?: number | null;
          cumulative_support?: number | null;
          current_probability?: number | null;
          id?: string;
          label?: string;
          market_id?: string;
          outcome_id?: string;
          post_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "outcomes_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          }
        ];
      };
      probability_snapshots: {
        Row: {
          id: string;
          market_id: string;
          probabilities: Json;
          timestamp: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          probabilities: Json;
          timestamp?: string;
        };
        Update: {
          id?: string;
          market_id?: string;
          probabilities?: Json;
          timestamp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "probability_snapshots_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          }
        ];
      };
      raw_posts: {
        Row: {
          author_followers: number | null;
          author_id: string | null;
          author_verified: boolean | null;
          expires_at: string | null;
          id: string;
          ingested_at: string;
          is_active: boolean | null;
          market_id: string;
          metrics: Json | null;
          text: string;
          x_post_id: string;
        };
        Insert: {
          author_followers?: number | null;
          author_id?: string | null;
          author_verified?: boolean | null;
          expires_at?: string | null;
          id?: string;
          ingested_at?: string;
          is_active?: boolean | null;
          market_id: string;
          metrics?: Json | null;
          text: string;
          x_post_id: string;
        };
        Update: {
          author_followers?: number | null;
          author_id?: string | null;
          author_verified?: boolean | null;
          expires_at?: string | null;
          id?: string;
          ingested_at?: string;
          is_active?: boolean | null;
          market_id?: string;
          metrics?: Json | null;
          text?: string;
          x_post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "raw_posts_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          }
        ];
      };
      scored_posts: {
        Row: {
          display_labels: Json | null;
          id: string;
          market_id: string;
          outcome_id: string;
          raw_post_id: string;
          scored_at: string;
          scores: Json;
        };
        Insert: {
          display_labels?: Json | null;
          id?: string;
          market_id: string;
          outcome_id: string;
          raw_post_id: string;
          scored_at?: string;
          scores: Json;
        };
        Update: {
          display_labels?: Json | null;
          id?: string;
          market_id?: string;
          outcome_id?: string;
          raw_post_id?: string;
          scored_at?: string;
          scores?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "scored_posts_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scored_posts_raw_post_id_fkey";
            columns: ["raw_post_id"];
            isOneToOne: false;
            referencedRelation: "raw_posts";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};


