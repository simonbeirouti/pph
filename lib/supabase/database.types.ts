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
    PostgrestVersion: "14.5"
  }
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
          version: number
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
          version?: number
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
          version?: number
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
      job_assets: {
        Row: {
          archived_at: string | null
          created_at: string
          id: number
          job_id: number
          kind: string
          mime_type: string
          organisation_id: number
          size_bytes: number
          storage_path: string
          submission_version: number
          uploaded_by_membership_id: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: never
          job_id: number
          kind?: string
          mime_type: string
          organisation_id: number
          size_bytes: number
          storage_path: string
          submission_version: number
          uploaded_by_membership_id: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: never
          job_id?: number
          kind?: string
          mime_type?: string
          organisation_id?: number
          size_bytes?: number
          storage_path?: string
          submission_version?: number
          uploaded_by_membership_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_assets_job_organisation_fkey"
            columns: ["job_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_assets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assets_uploader_organisation_fkey"
            columns: ["uploaded_by_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      job_notification_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          html_body: string | null
          id: number
          job_id: number
          last_attempted_at: string | null
          organisation_id: number
          provider_message_id: string | null
          recipient_email: string | null
          recipient_membership_id: number | null
          review_url: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["job_notification_status"]
          subject: string | null
          submission_update_id: number
          text_body: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          html_body?: string | null
          id?: never
          job_id: number
          last_attempted_at?: string | null
          organisation_id: number
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_membership_id?: number | null
          review_url?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["job_notification_status"]
          subject?: string | null
          submission_update_id: number
          text_body?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          html_body?: string | null
          id?: never
          job_id?: number
          last_attempted_at?: string | null
          organisation_id?: number
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_membership_id?: number | null
          review_url?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["job_notification_status"]
          subject?: string | null
          submission_update_id?: number
          text_body?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notification_deliveries_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notification_job_organisation_fkey"
            columns: ["job_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_notification_recipient_organisation_fkey"
            columns: ["recipient_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_notification_submission_update_fkey"
            columns: ["submission_update_id"]
            isOneToOne: false
            referencedRelation: "job_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_operation_receipts: {
        Row: {
          client_operation_id: string
          created_at: string
          id: number
          job_id: number
          membership_id: number
          operation_type: Database["public"]["Enums"]["job_operation_type"]
          organisation_id: number
          result: Json
        }
        Insert: {
          client_operation_id: string
          created_at?: string
          id?: never
          job_id: number
          membership_id: number
          operation_type: Database["public"]["Enums"]["job_operation_type"]
          organisation_id: number
          result: Json
        }
        Update: {
          client_operation_id?: string
          created_at?: string
          id?: never
          job_id?: number
          membership_id?: number
          operation_type?: Database["public"]["Enums"]["job_operation_type"]
          organisation_id?: number
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "job_operation_receipts_job_organisation_fkey"
            columns: ["job_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_operation_receipts_membership_organisation_fkey"
            columns: ["membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      job_schedule_occurrences: {
        Row: {
          attempt_count: number
          created_at: string
          generated_at: string | null
          id: number
          job_id: number | null
          last_attempted_at: string | null
          last_error: string | null
          occurrence_at: string
          organisation_id: number
          payload: Json
          schedule_id: number
          status: Database["public"]["Enums"]["job_schedule_occurrence_status"]
          updated_at: string
          version: number
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          generated_at?: string | null
          id?: never
          job_id?: number | null
          last_attempted_at?: string | null
          last_error?: string | null
          occurrence_at: string
          organisation_id: number
          payload: Json
          schedule_id: number
          status?: Database["public"]["Enums"]["job_schedule_occurrence_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          attempt_count?: number
          created_at?: string
          generated_at?: string | null
          id?: never
          job_id?: number | null
          last_attempted_at?: string | null
          last_error?: string | null
          occurrence_at?: string
          organisation_id?: number
          payload?: Json
          schedule_id?: number
          status?: Database["public"]["Enums"]["job_schedule_occurrence_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_schedule_occurrences_job_organisation_fkey"
            columns: ["job_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_schedule_occurrences_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_schedule_occurrences_schedule_organisation_fkey"
            columns: ["schedule_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "job_schedules"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      job_schedules: {
        Row: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          deleted_at: string | null
          ends_on: string | null
          id: number
          is_enabled: boolean
          local_time: string
          next_occurrence_at: string | null
          organisation_id: number
          recurrence_type: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on: string
          template_id: number
          timezone: string
          updated_at: string
          version: number
          weekdays: number[]
        }
        Insert: {
          assignee_membership_id?: number | null
          created_at?: string
          created_by: number
          deleted_at?: string | null
          ends_on?: string | null
          id?: never
          is_enabled?: boolean
          local_time: string
          next_occurrence_at?: string | null
          organisation_id: number
          recurrence_type: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on: string
          template_id: number
          timezone: string
          updated_at?: string
          version?: number
          weekdays?: number[]
        }
        Update: {
          assignee_membership_id?: number | null
          created_at?: string
          created_by?: number
          deleted_at?: string | null
          ends_on?: string | null
          id?: never
          is_enabled?: boolean
          local_time?: string
          next_occurrence_at?: string | null
          organisation_id?: number
          recurrence_type?: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on?: string
          template_id?: number
          timezone?: string
          updated_at?: string
          version?: number
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "job_schedules_assignee_organisation_fkey"
            columns: ["assignee_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_schedules_creator_organisation_fkey"
            columns: ["created_by", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_schedules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_schedules_template_organisation_fkey"
            columns: ["template_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      job_templates: {
        Row: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          id: number
          is_active: boolean
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          assignee_membership_id?: number | null
          created_at?: string
          created_by: number
          description?: string
          id?: never
          is_active?: boolean
          location?: string
          minimum_completion_photos?: number
          organisation_id: number
          priority?: Database["public"]["Enums"]["job_priority"]
          requires_completion_note?: boolean
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          assignee_membership_id?: number | null
          created_at?: string
          created_by?: number
          description?: string
          id?: never
          is_active?: boolean
          location?: string
          minimum_completion_photos?: number
          organisation_id?: number
          priority?: Database["public"]["Enums"]["job_priority"]
          requires_completion_note?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_templates_assignee_organisation_fkey"
            columns: ["assignee_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_templates_creator_organisation_fkey"
            columns: ["created_by", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "job_templates_organisation_id_fkey"
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
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
          required_reviewer_role?:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note?: boolean
          reviewed_at?: string | null
          reviewed_by_membership_id?: number | null
          reviewed_by_role?:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id?: number | null
          schedule_occurrence_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          submission_version?: number
          submitted_at?: string | null
          submitted_by_membership_id?: number | null
          template_id?: number | null
          title: string
          updated_at?: string
          version?: number
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
          required_reviewer_role?:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note?: boolean
          reviewed_at?: string | null
          reviewed_by_membership_id?: number | null
          reviewed_by_role?:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id?: number | null
          schedule_occurrence_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          submission_version?: number
          submitted_at?: string | null
          submitted_by_membership_id?: number | null
          template_id?: number | null
          title?: string
          updated_at?: string
          version?: number
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
          {
            foreignKeyName: "jobs_reviewer_organisation_fkey"
            columns: ["reviewed_by_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "jobs_schedule_organisation_fkey"
            columns: ["schedule_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "job_schedules"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "jobs_submitter_organisation_fkey"
            columns: ["submitted_by_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "jobs_template_organisation_fkey"
            columns: ["template_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      membership_role_audit: {
        Row: {
          actor_membership_id: number | null
          created_at: string
          id: number
          membership_id: number
          new_role: Database["public"]["Enums"]["membership_role"]
          organisation_id: number
          previous_role: Database["public"]["Enums"]["membership_role"] | null
        }
        Insert: {
          actor_membership_id?: number | null
          created_at?: string
          id?: never
          membership_id: number
          new_role: Database["public"]["Enums"]["membership_role"]
          organisation_id: number
          previous_role?: Database["public"]["Enums"]["membership_role"] | null
        }
        Update: {
          actor_membership_id?: number | null
          created_at?: string
          id?: never
          membership_id?: number
          new_role?: Database["public"]["Enums"]["membership_role"]
          organisation_id?: number
          previous_role?: Database["public"]["Enums"]["membership_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_role_audit_actor_organisation_fkey"
            columns: ["actor_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "membership_role_audit_membership_organisation_fkey"
            columns: ["membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "membership_role_audit_organisation_id_fkey"
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
          version: number
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
          version?: number
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
          version?: number
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
      offline_operation_receipts: {
        Row: {
          client_operation_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          membership_id: number
          operation_type: string
          organisation_id: number
          result: Json
        }
        Insert: {
          client_operation_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          membership_id: number
          operation_type: string
          organisation_id: number
          result: Json
        }
        Update: {
          client_operation_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          membership_id?: number
          operation_type?: string
          organisation_id?: number
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "offline_operation_receipts_membership_organisation_fkey"
            columns: ["membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      organisation_sync_changes: {
        Row: {
          changed_at: string
          entity_id: number
          entity_type: string
          operation: string
          operations_only: boolean
          organisation_id: number
          related_job_id: number | null
          revision: number
          scope_membership_id: number | null
        }
        Insert: {
          changed_at?: string
          entity_id: number
          entity_type: string
          operation: string
          operations_only?: boolean
          organisation_id: number
          related_job_id?: number | null
          revision?: never
          scope_membership_id?: number | null
        }
        Update: {
          changed_at?: string
          entity_id?: number
          entity_type?: string
          operation?: string
          operations_only?: boolean
          organisation_id?: number
          related_job_id?: number | null
          revision?: never
          scope_membership_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_sync_changes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_sync_changes_scope_organisation_fkey"
            columns: ["scope_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
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
          version: number
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      push_notification_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          event_id: number
          id: number
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string
          organisation_id: number
          recipient_membership_id: number
          response_status: number | null
          status: Database["public"]["Enums"]["push_delivery_status"]
          subscription_id: number
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event_id: number
          id?: never
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          organisation_id: number
          recipient_membership_id: number
          response_status?: number | null
          status?: Database["public"]["Enums"]["push_delivery_status"]
          subscription_id: number
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event_id?: number
          id?: never
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          organisation_id?: number
          recipient_membership_id?: number
          response_status?: number | null
          status?: Database["public"]["Enums"]["push_delivery_status"]
          subscription_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_recipient_organisation_fkey"
            columns: ["recipient_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "push_notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "push_notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_deliveries_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "web_push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_events: {
        Row: {
          actor_membership_id: number | null
          created_at: string
          deep_link: string
          event_key: string
          event_type: Database["public"]["Enums"]["push_event_type"]
          id: number
          job_id: number | null
          label: string
          organisation_id: number
          roster_shift_id: number | null
        }
        Insert: {
          actor_membership_id?: number | null
          created_at?: string
          deep_link: string
          event_key: string
          event_type: Database["public"]["Enums"]["push_event_type"]
          id?: never
          job_id?: number | null
          label: string
          organisation_id: number
          roster_shift_id?: number | null
        }
        Update: {
          actor_membership_id?: number | null
          created_at?: string
          deep_link?: string
          event_key?: string
          event_type?: Database["public"]["Enums"]["push_event_type"]
          id?: never
          job_id?: number | null
          label?: string
          organisation_id?: number
          roster_shift_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "push_events_actor_organisation_fkey"
            columns: ["actor_membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "push_events_job_organisation_fkey"
            columns: ["job_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "push_events_roster_shift_fkey"
            columns: ["roster_shift_id"]
            isOneToOne: false
            referencedRelation: "roster_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_shifts: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: number
          employee_membership_id: number
          ends_at: string
          id: number
          locked_at: string | null
          locked_by: number | null
          notes: string
          organisation_id: number
          starts_at: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: number
          employee_membership_id: number
          ends_at: string
          id?: never
          locked_at?: string | null
          locked_by?: number | null
          notes?: string
          organisation_id: number
          starts_at: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: number
          employee_membership_id?: number
          ends_at?: string
          id?: never
          locked_at?: string | null
          locked_by?: number | null
          notes?: string
          organisation_id?: number
          starts_at?: string
          updated_at?: string
          version?: number
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
            foreignKeyName: "roster_shifts_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
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
      web_push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          created_at: string
          deactivated_at: string | null
          endpoint: string
          id: number
          membership_id: number
          organisation_id: number
          p256dh: string
          updated_at: string
          user_agent: string
        }
        Insert: {
          active?: boolean
          auth: string
          created_at?: string
          deactivated_at?: string | null
          endpoint: string
          id?: never
          membership_id: number
          organisation_id: number
          p256dh: string
          updated_at?: string
          user_agent?: string
        }
        Update: {
          active?: boolean
          auth?: string
          created_at?: string
          deactivated_at?: string | null
          endpoint?: string
          id?: never
          membership_id?: number
          organisation_id?: number
          p256dh?: string
          updated_at?: string
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_push_subscriptions_membership_organisation_fkey"
            columns: ["membership_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_invited_membership: { Args: never; Returns: number }
      add_job_comment: {
        Args: { p_body: string; p_job_id: number }
        Returns: {
          author_membership_id: number | null
          body: string | null
          created_at: string
          id: number
          job_id: number
          metadata: Json
          organisation_id: number
          type: Database["public"]["Enums"]["job_update_type"]
        }
        SetofOptions: {
          from: "*"
          to: "job_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_job_note: {
        Args: { p_body: string; p_job_id: number }
        Returns: {
          author_membership_id: number | null
          body: string | null
          created_at: string
          id: number
          job_id: number
          metadata: Json
          organisation_id: number
          type: Database["public"]["Enums"]["job_update_type"]
        }
        SetofOptions: {
          from: "*"
          to: "job_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_job: {
        Args: { p_expected_submission_version: number; p_job_id: number }
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_job_evidence: {
        Args: { p_asset_id: number; p_job_id: number }
        Returns: {
          archived_at: string | null
          created_at: string
          id: number
          job_id: number
          kind: string
          mime_type: string
          organisation_id: number
          size_bytes: number
          storage_path: string
          submission_version: number
          uploaded_by_membership_id: number
        }
        SetofOptions: {
          from: "*"
          to: "job_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_roster_shift: {
        Args: { p_expected_updated_at: string; p_shift_id: number }
        Returns: number
      }
      change_membership_role: {
        Args: {
          p_membership_id: number
          p_role: Database["public"]["Enums"]["membership_role"]
        }
        Returns: {
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
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_offline_operation: {
        Args: {
          p_client_operation_id: string
          p_entity_id: string
          p_entity_type: string
          p_operation_type: string
        }
        Returns: {
          claimed: boolean
          result: Json
        }[]
      }
      complete_offline_operation: {
        Args: { p_client_operation_id: string; p_result: Json }
        Returns: Json
      }
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
          p_template_id?: number
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_job_schedule: {
        Args: {
          p_assignee_membership_id?: number
          p_ends_on?: string
          p_is_enabled?: boolean
          p_local_time?: string
          p_recurrence_type?: Database["public"]["Enums"]["job_schedule_recurrence"]
          p_starts_on?: string
          p_template_id: number
          p_weekdays?: number[]
        }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          deleted_at: string | null
          ends_on: string | null
          id: number
          is_enabled: boolean
          local_time: string
          next_occurrence_at: string | null
          organisation_id: number
          recurrence_type: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on: string
          template_id: number
          timezone: string
          updated_at: string
          version: number
          weekdays: number[]
        }
        SetofOptions: {
          from: "*"
          to: "job_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_job_template: {
        Args: {
          p_assignee_membership_id?: number
          p_description?: string
          p_location?: string
          p_minimum_completion_photos?: number
          p_priority?: Database["public"]["Enums"]["job_priority"]
          p_requires_completion_note?: boolean
          p_title: string
        }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          id: number
          is_active: boolean
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "job_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_roster_shift_with_jobs: {
        Args: {
          p_employee_membership_id: number
          p_ends_at: string
          p_job_ids?: number[]
          p_notes?: string
          p_starts_at: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: number
          employee_membership_id: number
          ends_at: string
          id: number
          locked_at: string | null
          locked_by: number | null
          notes: string
          organisation_id: number
          starts_at: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "roster_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team_member: {
        Args: {
          p_email: string
          p_first_name: string
          p_job_title: string
          p_last_name: string
          p_phone: string
          p_role: Database["public"]["Enums"]["membership_role"]
        }
        Returns: {
          created: boolean
          membership_id: number
          profile_id: number
        }[]
      }
      delete_invited_employee: {
        Args: { p_membership_id: number }
        Returns: boolean
      }
      delete_invited_team_member: {
        Args: { p_membership_id: number }
        Returns: boolean
      }
      delete_job: { Args: { p_job_id: number }; Returns: string[] }
      delete_job_schedule: {
        Args: { p_schedule_id: number }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          deleted_at: string | null
          ends_on: string | null
          id: number
          is_enabled: boolean
          local_time: string
          next_occurrence_at: string | null
          organisation_id: number
          recurrence_type: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on: string
          template_id: number
          timezone: string
          updated_at: string
          version: number
          weekdays: number[]
        }
        SetofOptions: {
          from: "*"
          to: "job_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_job_evidence: {
        Args: {
          p_job_id: number
          p_mime_type: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          id: number
          job_id: number
          kind: string
          mime_type: string
          organisation_id: number
          size_bytes: number
          storage_path: string
          submission_version: number
          uploaded_by_membership_id: number
        }
        SetofOptions: {
          from: "*"
          to: "job_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_offline_sync_changes: {
        Args: { p_after_revision: number }
        Returns: {
          changed_at: string
          entity_id: number
          entity_type: string
          operation: string
          related_job_id: number
          revision: number
        }[]
      }
      get_offline_sync_revision: { Args: never; Returns: number }
      link_invited_membership: { Args: never; Returns: number }
      list_employee_job_summary_rows: {
        Args: never
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_job_participant_identities: {
        Args: { p_job_id: number }
        Returns: {
          display_name: string
          membership_id: number
          role: Database["public"]["Enums"]["membership_role"]
        }[]
      }
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_job: {
        Args: {
          p_assignee_membership_id: number
          p_expected_submission_version: number
          p_feedback: string
          p_job_id: number
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replay_job_operation: {
        Args: {
          p_client_operation_id: string
          p_expected_version: number
          p_job_id: number
          p_operation_type: Database["public"]["Enums"]["job_operation_type"]
          p_payload?: Json
        }
        Returns: {
          job_version: number
          operation_status: string
          result: Json
        }[]
      }
      retry_job_notification: {
        Args: { p_delivery_id: number }
        Returns: {
          attempt_count: number
          created_at: string
          error_message: string | null
          html_body: string | null
          id: number
          job_id: number
          last_attempted_at: string | null
          organisation_id: number
          provider_message_id: string | null
          recipient_email: string | null
          recipient_membership_id: number | null
          review_url: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["job_notification_status"]
          subject: string | null
          submission_update_id: number
          text_body: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "job_notification_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retry_job_schedule: { Args: { p_schedule_id: number }; Returns: number }
      run_due_job_schedules: {
        Args: { p_limit?: number; p_now?: string }
        Returns: number
      }
      set_job_schedule_enabled: {
        Args: { p_is_enabled: boolean; p_schedule_id: number }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          deleted_at: string | null
          ends_on: string | null
          id: number
          is_enabled: boolean
          local_time: string
          next_occurrence_at: string | null
          organisation_id: number
          recurrence_type: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on: string
          template_id: number
          timezone: string
          updated_at: string
          version: number
          weekdays: number[]
        }
        SetofOptions: {
          from: "*"
          to: "job_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_job_template_active: {
        Args: { p_is_active: boolean; p_template_id: number }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          id: number
          is_active: boolean
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "job_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_membership_active: {
        Args: { p_active: boolean; p_membership_id: number }
        Returns: {
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
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_job: {
        Args: { p_job_id: number }
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_job: {
        Args: { p_job_id: number }
        Returns: {
          job_id: number
          notification_id: number
          submission_update_id: number
        }[]
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
          required_reviewer_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          requires_completion_note: boolean
          reviewed_at: string | null
          reviewed_by_membership_id: number | null
          reviewed_by_role:
            | Database["public"]["Enums"]["membership_role"]
            | null
          schedule_id: number | null
          schedule_occurrence_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          submission_version: number
          submitted_at: string | null
          submitted_by_membership_id: number | null
          template_id: number | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_job_schedule: {
        Args: {
          p_assignee_membership_id?: number
          p_ends_on?: string
          p_is_enabled?: boolean
          p_local_time?: string
          p_recurrence_type?: Database["public"]["Enums"]["job_schedule_recurrence"]
          p_schedule_id: number
          p_starts_on?: string
          p_template_id: number
          p_weekdays?: number[]
        }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          deleted_at: string | null
          ends_on: string | null
          id: number
          is_enabled: boolean
          local_time: string
          next_occurrence_at: string | null
          organisation_id: number
          recurrence_type: Database["public"]["Enums"]["job_schedule_recurrence"]
          starts_on: string
          template_id: number
          timezone: string
          updated_at: string
          version: number
          weekdays: number[]
        }
        SetofOptions: {
          from: "*"
          to: "job_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_job_template: {
        Args: {
          p_assignee_membership_id?: number
          p_description?: string
          p_location?: string
          p_minimum_completion_photos?: number
          p_priority?: Database["public"]["Enums"]["job_priority"]
          p_requires_completion_note?: boolean
          p_template_id: number
          p_title: string
        }
        Returns: {
          assignee_membership_id: number | null
          created_at: string
          created_by: number
          description: string
          id: number
          is_active: boolean
          location: string
          minimum_completion_photos: number
          organisation_id: number
          priority: Database["public"]["Enums"]["job_priority"]
          requires_completion_note: boolean
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "job_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      invite_delivery_status: "pending" | "sent" | "failed"
      job_notification_status: "queued" | "sending" | "sent" | "failed"
      job_operation_type: "start" | "note" | "photo" | "submit"
      job_priority: "low" | "normal" | "high" | "urgent"
      job_schedule_occurrence_status: "pending" | "generated" | "failed"
      job_schedule_recurrence: "daily" | "weekly"
      job_status: "assigned" | "in_progress" | "in_review" | "archived"
      job_update_type:
        | "note"
        | "comment"
        | "status_change"
        | "assignment_change"
        | "system"
      membership_role: "owner" | "manager" | "employee"
      membership_status: "invited" | "active" | "inactive"
      push_delivery_status:
        | "queued"
        | "sending"
        | "delivered"
        | "retry"
        | "permanent_failure"
      push_event_type:
        | "job_assignment"
        | "job_reassignment"
        | "job_submission"
        | "job_approved_or_archived"
        | "job_reopened"
        | "roster_assignment"
        | "roster_changed"
        | "roster_archived"
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
      job_notification_status: ["queued", "sending", "sent", "failed"],
      job_operation_type: ["start", "note", "photo", "submit"],
      job_priority: ["low", "normal", "high", "urgent"],
      job_schedule_occurrence_status: ["pending", "generated", "failed"],
      job_schedule_recurrence: ["daily", "weekly"],
      job_status: ["assigned", "in_progress", "in_review", "archived"],
      job_update_type: [
        "note",
        "comment",
        "status_change",
        "assignment_change",
        "system",
      ],
      membership_role: ["owner", "manager", "employee"],
      membership_status: ["invited", "active", "inactive"],
      push_delivery_status: [
        "queued",
        "sending",
        "delivered",
        "retry",
        "permanent_failure",
      ],
      push_event_type: [
        "job_assignment",
        "job_reassignment",
        "job_submission",
        "job_approved_or_archived",
        "job_reopened",
        "roster_assignment",
        "roster_changed",
        "roster_archived",
      ],
    },
  },
} as const
