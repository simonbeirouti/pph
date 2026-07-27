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
      employee_profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          first_name: string
          id: number
          job_title: string
          last_name: string
          membership_id: number
          organisation_id: number
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          first_name: string
          id?: never
          job_title?: string
          last_name: string
          membership_id: number
          organisation_id: number
          phone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          first_name?: string
          id?: never
          job_title?: string
          last_name?: string
          membership_id?: number
          organisation_id?: number
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_membership_organisation_fkey"
            columns: ["membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "employee_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_updates: {
        Row: {
          author_membership_id: number | null
          body: string | null
          created_at: string
          id: number
          job_id: number
          metadata: Json
          organisation_id: number
          type: Database["public"]["Enums"]["job_update_type"]
        }
        Insert: {
          author_membership_id?: number | null
          body?: string | null
          created_at?: string
          id?: never
          job_id: number
          metadata?: Json
          organisation_id: number
          type: Database["public"]["Enums"]["job_update_type"]
        }
        Update: {
          author_membership_id?: number | null
          body?: string | null
          created_at?: string
          id?: never
          job_id?: number
          metadata?: Json
          organisation_id?: number
          type?: Database["public"]["Enums"]["job_update_type"]
        }
        Relationships: [
          {
            foreignKeyName: "job_updates_author_organisation_fkey"
            columns: ["author_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_updates_job_organisation_fkey"
            columns: ["job_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_updates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          archived_at: string | null
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          due_at: string | null
          id: number
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submitted_at: string | null
          template_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assignee_membership_id?: number | null
          created_at?: string
          created_by: number
          description?: string
          due_at?: string | null
          id?: never
          location?: string
          minimum_completion_photos?: number
          organisation_id: number
          priority?: Database["public"]["Enums"]["job_priority"]
          requires_completion_note?: boolean
          schedule_id?: number | null
          schedule_occurrence_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          submitted_at?: string | null
          template_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assignee_membership_id?: number | null
          created_at?: string
          created_by?: number
          description?: string
          due_at?: string | null
          id?: never
          location?: string
          minimum_completion_photos?: number
          organisation_id?: number
          priority?: Database["public"]["Enums"]["job_priority"]
          requires_completion_note?: boolean
          schedule_id?: number | null
          schedule_occurrence_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          submitted_at?: string | null
          template_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assignee_organisation_fkey"
            columns: ["assignee_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "jobs_creator_organisation_fkey"
            columns: ["created_by", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          activated_at: string | null
          created_at: string
          deactivated_at: string | null
          email: string
          id: number
          invite_delivery_status: Database["public"]["Enums"]["invite_delivery_status"]
          invite_last_attempted_at: string | null
          invited_at: string | null
          organisation_id: number
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          email: string
          id?: never
          invite_delivery_status?: Database["public"]["Enums"]["invite_delivery_status"]
          invite_last_attempted_at?: string | null
          invited_at?: string | null
          organisation_id: number
          role: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string
          id?: never
          invite_delivery_status?: Database["public"]["Enums"]["invite_delivery_status"]
          invite_last_attempted_at?: string | null
          invited_at?: string | null
          organisation_id?: number
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: number
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      roster_shifts: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: number
          employee_membership_id: number
          ends_at: string
          id: number
          notes: string
          organisation_id: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: number
          employee_membership_id: number
          ends_at: string
          id?: never
          notes?: string
          organisation_id: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: number
          employee_membership_id?: number
          ends_at?: string
          id?: never
          notes?: string
          organisation_id?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_shifts_creator_organisation_fkey"
            columns: ["created_by", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "roster_shifts_employee_organisation_fkey"
            columns: ["employee_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "roster_shifts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_invited_membership: { Args: never; Returns: number }
      create_employee: {
        Args: {
          p_email: string
          p_first_name: string
          p_job_title: string
          p_last_name: string
          p_phone: string
        }
        Returns: {
          auth_user_id: string
          created: boolean
          membership_id: number
          membership_status: Database["public"]["Enums"]["membership_status"]
          profile_id: number
        }[]
      }
      create_job: {
        Args: {
          p_assignee_membership_id?: number
          p_description?: string
          p_due_at?: string
          p_location?: string
          p_minimum_completion_photos?: number
          p_priority?: Database["public"]["Enums"]["job_priority"]
          p_requires_completion_note?: boolean
          p_scheduled_at?: string
          p_title: string
        }
        Returns: {
          archived_at: string | null
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          due_at: string | null
          id: number
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submitted_at: string | null
          template_id: number | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_invited_employee: {
        Args: { p_membership_id: number }
        Returns: boolean
      }
      link_invited_membership: { Args: never; Returns: number }
      reassign_job: {
        Args: { p_assignee_membership_id?: number; p_job_id: number }
        Returns: {
          archived_at: string | null
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          due_at: string | null
          id: number
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submitted_at: string | null
          template_id: number | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_job: {
        Args: {
          p_assignee_membership_id?: number
          p_description?: string
          p_due_at?: string
          p_job_id: number
          p_location?: string
          p_minimum_completion_photos?: number
          p_priority?: Database["public"]["Enums"]["job_priority"]
          p_requires_completion_note?: boolean
          p_scheduled_at?: string
          p_title: string
        }
        Returns: {
          archived_at: string | null
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          due_at: string | null
          id: number
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submitted_at: string | null
          template_id: number | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      invite_delivery_status: "pending" | "sent" | "failed"
      job_priority: "low" | "normal" | "high" | "urgent"
      job_status: "assigned" | "in_progress" | "in_review" | "archived"
      job_update_type:
        | "note"
        | "comment"
        | "status_change"
        | "assignment_change"
        | "system"
      membership_role: "owner" | "employee"
      membership_status: "invited" | "active" | "inactive"
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
      invite_delivery_status: ["pending", "sent", "failed"],
      job_priority: ["low", "normal", "high", "urgent"],
      job_status: ["assigned", "in_progress", "in_review", "archived"],
      job_update_type: [
        "note",
        "comment",
        "status_change",
        "assignment_change",
        "system",
      ],
      membership_role: ["owner", "employee"],
      membership_status: ["invited", "active", "inactive"],
    },
  },
} as const
