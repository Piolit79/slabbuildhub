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
      coi_reminders: {
        Row: {
          coi_id: string
          expiration_date: string
          id: string
          policy_type: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          coi_id: string
          expiration_date: string
          id?: string
          policy_type: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          coi_id?: string
          expiration_date?: string
          id?: string
          policy_type?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coi_reminders_coi_id_fkey"
            columns: ["coi_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_cois"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_settings: {
        Row: {
          additional_insured_required: boolean
          agreement_file_path: string | null
          company_name: string | null
          created_at: string
          id: string
          min_gl_coverage_limit: string | null
          notification_email: string | null
          owner_info: string | null
          property_address: string | null
          updated_at: string
          wc_required: boolean
        }
        Insert: {
          additional_insured_required?: boolean
          agreement_file_path?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          min_gl_coverage_limit?: string | null
          notification_email?: string | null
          owner_info?: string | null
          property_address?: string | null
          updated_at?: string
          wc_required?: boolean
        }
        Update: {
          additional_insured_required?: boolean
          agreement_file_path?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          min_gl_coverage_limit?: string | null
          notification_email?: string | null
          owner_info?: string | null
          property_address?: string | null
          updated_at?: string
          wc_required?: boolean
        }
        Relationships: []
      }
      projects: {
        Row: {
          address: string
          client: string
          created_at: string
          id: string
          name: string
          reminder_body: string | null
          reminder_subject: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string
          client?: string
          created_at?: string
          id?: string
          name: string
          reminder_body?: string | null
          reminder_subject?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          client?: string
          created_at?: string
          id?: string
          name?: string
          reminder_body?: string | null
          reminder_subject?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subcontractor_cois: {
        Row: {
          action_over: string
          additional_insured: string
          certificate_holder: string | null
          coi_file_path: string | null
          company: string
          contact_email1: string | null
          contact_email2: string | null
          created_at: string
          description_of_operations: string | null
          gl_aggregate_limit: string | null
          gl_carrier: string | null
          gl_coverage_limit: string | null
          gl_effective_date: string | null
          gl_expiration_date: string | null
          gl_per_occurrence_limit: string | null
          gl_policy_file_path: string | null
          gl_policy_number: string | null
          hammer_clause: string
          id: string
          is_active: boolean
          labor_law_coverage: string
          project_id: string
          subcontractor: string
          umbrella_carrier: string | null
          umbrella_effective_date: string | null
          umbrella_expiration_date: string | null
          umbrella_limit: string | null
          umbrella_policy_number: string | null
          updated_at: string
          user_id: string | null
          wc_carrier: string | null
          wc_effective_date: string | null
          wc_expiration_date: string | null
          wc_policy_number: string | null
        }
        Insert: {
          action_over?: string
          additional_insured?: string
          certificate_holder?: string | null
          coi_file_path?: string | null
          company?: string
          contact_email1?: string | null
          contact_email2?: string | null
          created_at?: string
          description_of_operations?: string | null
          gl_aggregate_limit?: string | null
          gl_carrier?: string | null
          gl_coverage_limit?: string | null
          gl_effective_date?: string | null
          gl_expiration_date?: string | null
          gl_per_occurrence_limit?: string | null
          gl_policy_file_path?: string | null
          gl_policy_number?: string | null
          hammer_clause?: string
          id?: string
          is_active?: boolean
          labor_law_coverage?: string
          project_id: string
          subcontractor: string
          umbrella_carrier?: string | null
          umbrella_effective_date?: string | null
          umbrella_expiration_date?: string | null
          umbrella_limit?: string | null
          umbrella_policy_number?: string | null
          updated_at?: string
          user_id?: string | null
          wc_carrier?: string | null
          wc_effective_date?: string | null
          wc_expiration_date?: string | null
          wc_policy_number?: string | null
        }
        Update: {
          action_over?: string
          additional_insured?: string
          certificate_holder?: string | null
          coi_file_path?: string | null
          company?: string
          contact_email1?: string | null
          contact_email2?: string | null
          created_at?: string
          description_of_operations?: string | null
          gl_aggregate_limit?: string | null
          gl_carrier?: string | null
          gl_coverage_limit?: string | null
          gl_effective_date?: string | null
          gl_expiration_date?: string | null
          gl_per_occurrence_limit?: string | null
          gl_policy_file_path?: string | null
          gl_policy_number?: string | null
          hammer_clause?: string
          id?: string
          is_active?: boolean
          labor_law_coverage?: string
          project_id?: string
          subcontractor?: string
          umbrella_carrier?: string | null
          umbrella_effective_date?: string | null
          umbrella_expiration_date?: string | null
          umbrella_limit?: string | null
          umbrella_policy_number?: string | null
          updated_at?: string
          user_id?: string | null
          wc_carrier?: string | null
          wc_effective_date?: string | null
          wc_expiration_date?: string | null
          wc_policy_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_cois_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
