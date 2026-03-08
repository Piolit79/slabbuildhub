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
      budget_items: {
        Row: {
          id: string
          project_id: string
          category: string
          description: string
          labor: number
          material: number
          optional: number
          subcontractor: string
          notes: string
          status: string
          sort_order: number
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          category: string
          description: string
          labor?: number
          material?: number
          optional?: number
          subcontractor?: string
          notes?: string
          status?: string
          sort_order?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          category?: string
          description?: string
          labor?: number
          material?: number
          optional?: number
          subcontractor?: string
          notes?: string
          status?: string
          sort_order?: number
          created_at?: string | null
        }
        Relationships: []
      }
      budget_settings: {
        Row: {
          id: string
          project_id: string
          design_fee_pct: number
          build_fee_pct: number
          category_order: Json
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          design_fee_pct?: number
          build_fee_pct?: number
          category_order?: Json
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          design_fee_pct?: number
          build_fee_pct?: number
          category_order?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      coi_files: {
        Row: {
          coi_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          project_id: string
          uploaded_at: string | null
        }
        Insert: {
          coi_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          project_id: string
          uploaded_at?: string | null
        }
        Update: {
          coi_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          project_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coi_files_coi_id_fkey"
            columns: ["coi_id"]
            isOneToOne: false
            referencedRelation: "cois"
            referencedColumns: ["id"]
          },
        ]
      }
      cois: {
        Row: {
          additional_insured: string | null
          carrier: string | null
          certificate_holder: string | null
          company: string | null
          contact_email1: string | null
          contact_email2: string | null
          created_at: string | null
          effective_date: string | null
          expiration_date: string
          gl_aggregate_limit: string | null
          gl_carrier: string | null
          gl_coverage_limit: string | null
          gl_effective_date: string | null
          gl_expiration_date: string | null
          gl_per_occurrence_limit: string | null
          gl_policy_number: string | null
          gl_provisions: Json | null
          id: string
          insured_name: string
          is_active: boolean | null
          policy_number: string | null
          project_id: string
          vendor_id: string | null
          wc_carrier: string | null
          wc_effective_date: string | null
          wc_expiration_date: string | null
          wc_policy_number: string | null
        }
        Insert: {
          additional_insured?: string | null
          carrier?: string | null
          certificate_holder?: string | null
          company?: string | null
          contact_email1?: string | null
          contact_email2?: string | null
          created_at?: string | null
          effective_date?: string | null
          expiration_date: string
          gl_aggregate_limit?: string | null
          gl_carrier?: string | null
          gl_coverage_limit?: string | null
          gl_effective_date?: string | null
          gl_expiration_date?: string | null
          gl_per_occurrence_limit?: string | null
          gl_policy_number?: string | null
          gl_provisions?: Json | null
          id?: string
          insured_name: string
          is_active?: boolean | null
          policy_number?: string | null
          project_id: string
          vendor_id?: string | null
          wc_carrier?: string | null
          wc_effective_date?: string | null
          wc_expiration_date?: string | null
          wc_policy_number?: string | null
        }
        Update: {
          additional_insured?: string | null
          carrier?: string | null
          certificate_holder?: string | null
          company?: string | null
          contact_email1?: string | null
          contact_email2?: string | null
          created_at?: string | null
          effective_date?: string | null
          expiration_date?: string
          gl_aggregate_limit?: string | null
          gl_carrier?: string | null
          gl_coverage_limit?: string | null
          gl_effective_date?: string | null
          gl_expiration_date?: string | null
          gl_per_occurrence_limit?: string | null
          gl_policy_number?: string | null
          gl_provisions?: Json | null
          id?: string
          insured_name?: string
          is_active?: boolean | null
          policy_number?: string | null
          project_id?: string
          vendor_id?: string | null
          wc_carrier?: string | null
          wc_effective_date?: string | null
          wc_expiration_date?: string | null
          wc_policy_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
