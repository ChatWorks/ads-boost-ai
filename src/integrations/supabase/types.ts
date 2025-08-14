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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          created_at: string
          google_ads_account_id: string | null
          id: string
          is_archived: boolean
          last_message_at: string | null
          message_count: number
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_ads_account_id?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          message_count?: number
          summary?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_ads_account_id?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          message_count?: number
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_google_ads_account_id_fkey"
            columns: ["google_ads_account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          context_data: Json | null
          conversation_id: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          processing_time_ms: number | null
          role: string
          sequence_number: number
          token_count: number | null
          user_id: string
        }
        Insert: {
          content: string
          context_data?: Json | null
          conversation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          role: string
          sequence_number: number
          token_count?: number | null
          user_id: string
        }
        Update: {
          content?: string
          context_data?: Json | null
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          role?: string
          sequence_number?: number
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_accounts: {
        Row: {
          account_name: string | null
          account_type: string | null
          connection_status: string | null
          created_at: string
          currency_code: string | null
          customer_id: string
          developer_token_status: string | null
          id: string
          is_active: boolean | null
          is_manager: boolean | null
          last_connection_test: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_successful_fetch: string | null
          login_customer_id: string | null
          needs_reconnection: boolean | null
          refresh_token: string
          time_zone: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_type?: string | null
          connection_status?: string | null
          created_at?: string
          currency_code?: string | null
          customer_id: string
          developer_token_status?: string | null
          id?: string
          is_active?: boolean | null
          is_manager?: boolean | null
          last_connection_test?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_successful_fetch?: string | null
          login_customer_id?: string | null
          needs_reconnection?: boolean | null
          refresh_token: string
          time_zone?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_type?: string | null
          connection_status?: string | null
          created_at?: string
          currency_code?: string | null
          customer_id?: string
          developer_token_status?: string | null
          id?: string
          is_active?: boolean | null
          is_manager?: boolean | null
          last_connection_test?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_successful_fetch?: string | null
          login_customer_id?: string | null
          needs_reconnection?: boolean | null
          refresh_token?: string
          time_zone?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_metrics_cache: {
        Row: {
          account_id: string | null
          cache_key: string
          created_at: string | null
          data: Json
          expires_at: string
          id: string
          query_hash: string
        }
        Insert: {
          account_id?: string | null
          cache_key: string
          created_at?: string | null
          data: Json
          expires_at: string
          id?: string
          query_hash: string
        }
        Update: {
          account_id?: string | null
          cache_key?: string
          created_at?: string | null
          data?: Json
          expires_at?: string
          id?: string
          query_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_metrics_cache_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_metrics_daily: {
        Row: {
          account_id: string | null
          created_at: string | null
          date: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          metrics: Json
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          metrics: Json
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          metrics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_metrics_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          google_ads_account_id: string
          id: string
          metrics_snapshot: Json
          sent_at: string
          status: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          google_ads_account_id: string
          id?: string
          metrics_snapshot?: Json
          sent_at?: string
          status?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          google_ads_account_id?: string
          id?: string
          metrics_snapshot?: Json
          sent_at?: string
          status?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_log_account"
            columns: ["google_ads_account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_log_subscription"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "insights_email_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_email_subscriptions: {
        Row: {
          created_at: string
          frequency: Database["public"]["Enums"]["email_frequency"]
          google_ads_account_id: string
          id: string
          is_paused: boolean
          last_sent_at: string | null
          selected_metrics: string[]
          send_time: string
          time_zone: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["email_frequency"]
          google_ads_account_id: string
          id?: string
          is_paused?: boolean
          last_sent_at?: string | null
          selected_metrics?: string[]
          send_time?: string
          time_zone?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["email_frequency"]
          google_ads_account_id?: string
          id?: string
          is_paused?: boolean
          last_sent_at?: string | null
          selected_metrics?: string[]
          send_time?: string
          time_zone?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscription_account"
            columns: ["google_ads_account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          selected_google_ads_account_id: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          selected_google_ads_account_id?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          selected_google_ads_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_selected_google_ads_account_fk"
            columns: ["selected_google_ads_account_id"]
            isOneToOne: false
            referencedRelation: "google_ads_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_conversations: {
        Args: { keep_count?: number; target_user_id?: string }
        Returns: number
      }
      get_conversation_context: {
        Args: { conversation_uuid: string; message_limit?: number }
        Returns: {
          content: string
          context_data: Json
          created_at: string
          message_id: string
          metadata: Json
          role: string
          sequence_number: number
        }[]
      }
    }
    Enums: {
      email_frequency: "daily" | "weekly" | "monthly"
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
      email_frequency: ["daily", "weekly", "monthly"],
    },
  },
} as const
