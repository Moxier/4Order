export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      feedback: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          idempotency_key: string
          message: string
          order_id: string | null
          order_line_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string
          severity: Database["public"]["Enums"]["feedback_severity"]
          status: Database["public"]["Enums"]["feedback_status"]
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          message: string
          order_id?: string | null
          order_line_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id: string
          severity?: Database["public"]["Enums"]["feedback_severity"]
          status?: Database["public"]["Enums"]["feedback_status"]
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          message?: string
          order_id?: string | null
          order_line_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string
          severity?: Database["public"]["Enums"]["feedback_severity"]
          status?: Database["public"]["Enums"]["feedback_status"]
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_order_line_id_order_id_fkey"
            columns: ["order_line_id", "order_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id", "order_id"]
          },
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          created_at: string
          id: string
          line_number: number
          order_id: string
          original_text: string
          price_amount: number | null
          priced_at: string | null
          priced_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_number: number
          order_id: string
          original_text: string
          price_amount?: number | null
          priced_at?: string | null
          priced_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_number?: number
          order_id?: string
          original_text?: string
          price_amount?: number | null
          priced_at?: string | null
          priced_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          acknowledged_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          order_number: number
          original_text: string
          preparing_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          order_number?: number
          original_text: string
          preparing_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          order_number?: number
          original_text?: string
          preparing_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_received: number | null
          change_amount: number | null
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          amount_received?: number | null
          change_amount?: number | null
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_received?: number | null
          change_amount?: number | null
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          order_id: string | null
          payload: Json
          printed_at: string | null
          printer: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["print_job_status"]
          type: Database["public"]["Enums"]["print_job_type"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          payload?: Json
          printed_at?: string | null
          printer?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["print_job_status"]
          type: Database["public"]["Enums"]["print_job_type"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          payload?: Json
          printed_at?: string | null
          printer?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["print_job_status"]
          type?: Database["public"]["Enums"]["print_job_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          public_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          public_token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          public_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          idempotency_key: string
          resolved_at: string | null
          resolved_by: string | null
          session_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          type: Database["public"]["Enums"]["service_request_type"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["service_request_status"]
          type: Database["public"]["Enums"]["service_request_type"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["service_request_status"]
          type?: Database["public"]["Enums"]["service_request_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          opened_at: string
          status: Database["public"]["Enums"]["table_session_status"]
          table_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          status?: Database["public"]["Enums"]["table_session_status"]
          table_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          status?: Database["public"]["Enums"]["table_session_status"]
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      feedback_severity: "FEEDBACK" | "ISSUE" | "NEEDS_ASSISTANCE"
      feedback_status: "NEW" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED"
      feedback_type: "FOOD" | "SERVICE" | "CLEANLINESS" | "GENERAL"
      order_status: "NEW" | "ACKNOWLEDGED" | "PREPARING" | "DONE" | "CANCELLED"
      payment_method: "CASH" | "PROMPTPAY" | "OTHER"
      payment_status: "PENDING" | "COMPLETED" | "VOIDED"
      print_job_status:
        | "PENDING"
        | "PROCESSING"
        | "PRINTED"
        | "FAILED"
        | "CANCELLED"
      print_job_type: "KITCHEN_TICKET" | "BILL" | "TEST"
      service_request_status: "NEW" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED"
      service_request_type: "CALL_STAFF" | "REQUEST_BILL" | "URGENT_ASSISTANCE"
      staff_role: "KITCHEN" | "CASHIER" | "ADMIN"
      table_session_status: "ACTIVE" | "CLOSED"
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
      feedback_severity: ["FEEDBACK", "ISSUE", "NEEDS_ASSISTANCE"],
      feedback_status: ["NEW", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"],
      feedback_type: ["FOOD", "SERVICE", "CLEANLINESS", "GENERAL"],
      order_status: ["NEW", "ACKNOWLEDGED", "PREPARING", "DONE", "CANCELLED"],
      payment_method: ["CASH", "PROMPTPAY", "OTHER"],
      payment_status: ["PENDING", "COMPLETED", "VOIDED"],
      print_job_status: [
        "PENDING",
        "PROCESSING",
        "PRINTED",
        "FAILED",
        "CANCELLED",
      ],
      print_job_type: ["KITCHEN_TICKET", "BILL", "TEST"],
      service_request_status: ["NEW", "ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
      service_request_type: ["CALL_STAFF", "REQUEST_BILL", "URGENT_ASSISTANCE"],
      staff_role: ["KITCHEN", "CASHIER", "ADMIN"],
      table_session_status: ["ACTIVE", "CLOSED"],
    },
  },
} as const

