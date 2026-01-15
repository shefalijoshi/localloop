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
      assists: {
        Row: {
          completed_at: string | null
          created_at: string | null
          expected_duration: number
          helper_id: string
          helper_shared_email: boolean | null
          helper_shared_phone: boolean | null
          id: string
          offer_id: string | null
          request_id: string
          seeker_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["assist_status"] | null
          verification_code: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          expected_duration: number
          helper_id: string
          helper_shared_email?: boolean | null
          helper_shared_phone?: boolean | null
          id?: string
          offer_id?: string | null
          request_id: string
          seeker_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assist_status"] | null
          verification_code: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          expected_duration?: number
          helper_id?: string
          helper_shared_email?: boolean | null
          helper_shared_phone?: boolean | null
          id?: string
          offer_id?: string | null
          request_id?: string
          seeker_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assist_status"] | null
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "assists_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "assists_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "view_assist_details"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "assists_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "assists_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_relationships: {
        Row: {
          approval_mode: Database["public"]["Enums"]["approval_mode"] | null
          caregiver_id: string
          created_at: string | null
          dependent_id: string
          id: string
        }
        Insert: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"] | null
          caregiver_id: string
          created_at?: string | null
          dependent_id: string
          id?: string
        }
        Update: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"] | null
          caregiver_id?: string
          created_at?: string | null
          dependent_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_relationships_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "caregiver_relationships_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_relationships_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_relationships_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "caregiver_relationships_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_relationships_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_details: {
        Row: {
          created_at: string | null
          dog_size: Database["public"]["Enums"]["dog_size"] | null
          id: string
          name: string
          seeker_id: string
          special_needs: string | null
          temperament: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dog_size?: Database["public"]["Enums"]["dog_size"] | null
          id?: string
          name: string
          seeker_id: string
          special_needs?: string | null
          temperament?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dog_size?: Database["public"]["Enums"]["dog_size"] | null
          id?: string
          name?: string
          seeker_id?: string
          special_needs?: string | null
          temperament?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_details_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "help_details_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_details_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          expires_at: string
          id: string
          neighborhood_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          expires_at: string
          id?: string
          neighborhood_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string
          id?: string
          neighborhood_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          assist_id: string
          created_at: string | null
          description: string | null
          id: string
          neighborhood_id: string | null
          reported_against: string
          reported_by: string
        }
        Insert: {
          assist_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          neighborhood_id?: string | null
          reported_against: string
          reported_by: string
        }
        Update: {
          assist_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          neighborhood_id?: string | null
          reported_against?: string
          reported_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_reports_assist_id_fkey"
            columns: ["assist_id"]
            isOneToOne: false
            referencedRelation: "assists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reports_assist_id_fkey"
            columns: ["assist_id"]
            isOneToOne: false
            referencedRelation: "view_assist_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reports_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reports_reported_against_fkey"
            columns: ["reported_against"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "issue_reports_reported_against_fkey"
            columns: ["reported_against"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reports_reported_against_fkey"
            columns: ["reported_against"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "issue_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhood_memberships: {
        Row: {
          id: string
          invited_at: string | null
          joined_at: string | null
          neighborhood_id: string
          primary_vouch_by: string | null
          profile_id: string
          secondary_vouch_by: string | null
          status: Database["public"]["Enums"]["membership_status"] | null
          user_id: string
          vouch_code_expires_at: string | null
          vouch_verification_code: string | null
        }
        Insert: {
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          neighborhood_id: string
          primary_vouch_by?: string | null
          profile_id: string
          secondary_vouch_by?: string | null
          status?: Database["public"]["Enums"]["membership_status"] | null
          user_id: string
          vouch_code_expires_at?: string | null
          vouch_verification_code?: string | null
        }
        Update: {
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          neighborhood_id?: string
          primary_vouch_by?: string | null
          profile_id?: string
          secondary_vouch_by?: string | null
          status?: Database["public"]["Enums"]["membership_status"] | null
          user_id?: string
          vouch_code_expires_at?: string | null
          vouch_verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhood_memberships_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_primary_vouch_by_fkey"
            columns: ["primary_vouch_by"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_primary_vouch_by_fkey"
            columns: ["primary_vouch_by"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_primary_vouch_by_fkey"
            columns: ["primary_vouch_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_secondary_vouch_by_fkey"
            columns: ["secondary_vouch_by"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_secondary_vouch_by_fkey"
            columns: ["secondary_vouch_by"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_memberships_secondary_vouch_by_fkey"
            columns: ["secondary_vouch_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          radius_miles: number | null
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          radius_miles?: number | null
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          radius_miles?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "neighborhoods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhoods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string | null
          helper_id: string
          id: string
          note: string | null
          request_id: string
          share_email: boolean | null
          share_phone: boolean | null
          status: Database["public"]["Enums"]["offer_status"] | null
        }
        Insert: {
          created_at?: string | null
          helper_id: string
          id?: string
          note?: string | null
          request_id: string
          share_email?: boolean | null
          share_phone?: boolean | null
          status?: Database["public"]["Enums"]["offer_status"] | null
        }
        Update: {
          created_at?: string | null
          helper_id?: string
          id?: string
          note?: string | null
          request_id?: string
          share_email?: boolean | null
          share_phone?: boolean | null
          status?: Database["public"]["Enums"]["offer_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "offers_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "view_assist_details"
            referencedColumns: ["request_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          is_available: boolean | null
          is_flagged: boolean | null
          location_verified: boolean | null
          location_verified_at: string | null
          neighborhood_id: string | null
          phone: string | null
          rate: number | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_available?: boolean | null
          is_flagged?: boolean | null
          location_verified?: boolean | null
          location_verified_at?: string | null
          neighborhood_id?: string | null
          phone?: string | null
          rate?: number | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_available?: boolean | null
          is_flagged?: boolean | null
          location_verified?: boolean | null
          location_verified_at?: string | null
          neighborhood_id?: string | null
          phone?: string | null
          rate?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          action_id: string
          category_id: string
          created_at: string | null
          details: string | null
          duration: number
          expires_at: string
          full_address: string
          help_detail_id: string | null
          id: string
          neighborhood_id: string
          request_type: string
          seeker_id: string
          snapshot_data: Json | null
          status: Database["public"]["Enums"]["request_status"] | null
          street_name: string
          subject_tag: string | null
          timeframe: string | null
          updated_at: string | null
        }
        Insert: {
          action_id: string
          category_id: string
          created_at?: string | null
          details?: string | null
          duration: number
          expires_at: string
          full_address: string
          help_detail_id?: string | null
          id?: string
          neighborhood_id: string
          request_type: string
          seeker_id: string
          snapshot_data?: Json | null
          status?: Database["public"]["Enums"]["request_status"] | null
          street_name: string
          subject_tag?: string | null
          timeframe?: string | null
          updated_at?: string | null
        }
        Update: {
          action_id?: string
          category_id?: string
          created_at?: string | null
          details?: string | null
          duration?: number
          expires_at?: string
          full_address?: string
          help_detail_id?: string | null
          id?: string
          neighborhood_id?: string
          request_type?: string
          seeker_id?: string
          snapshot_data?: Json | null
          status?: Database["public"]["Enums"]["request_status"] | null
          street_name?: string
          subject_tag?: string | null
          timeframe?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_help_detail_id_fkey"
            columns: ["help_detail_id"]
            isOneToOne: false
            referencedRelation: "help_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_users: {
        Row: {
          assigned_at: string | null
          id: string
          neighborhood_id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          neighborhood_id: string
          profile_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          neighborhood_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seed_users_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "seed_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profile_details: {
        Row: {
          address: string | null
          display_name: string | null
          email: string | null
          phone: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      profile_with_stats: {
        Row: {
          address: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_available: boolean | null
          is_flagged: boolean | null
          location_verified: boolean | null
          location_verified_at: string | null
          neighborhood_id: string | null
          phone: string | null
          rate: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          total_assists: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_available?: boolean | null
          is_flagged?: boolean | null
          location_verified?: boolean | null
          location_verified_at?: string | null
          neighborhood_id?: string | null
          phone?: string | null
          rate?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          total_assists?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_available?: boolean | null
          is_flagged?: boolean | null
          location_verified?: boolean | null
          location_verified_at?: string | null
          neighborhood_id?: string | null
          phone?: string | null
          rate?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          total_assists?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      view_assist_details: {
        Row: {
          action_id: string | null
          category_id: string | null
          completed_at: string | null
          created_at: string | null
          details: string | null
          expected_duration: number | null
          helper_email: string | null
          helper_id: string | null
          helper_name: string | null
          helper_phone: string | null
          id: string | null
          request_id: string | null
          request_type: string | null
          scheduled_time: string | null
          seeker_address: string | null
          seeker_email: string | null
          seeker_id: string | null
          seeker_name: string | null
          snapshot_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["assist_status"] | null
          subject_tag: string | null
          verification_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assists_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "assists_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_details"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profile_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_neighborhood_offer: {
        Args: { target_offer_id: string }
        Returns: undefined
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      complete_assist: { Args: { p_assist_id: string }; Returns: undefined }
      create_neighborhood_request: {
        Args: {
          p_action_id: string
          p_category_id: string
          p_details: string
          p_duration: number
          p_help_detail_id?: string
          p_request_type: string
          p_scheduled_time?: string
          p_subject_tag: string
        }
        Returns: string
      }
      create_walk_request: {
        Args: {
          p_duration: number
          p_help_detail_id: string
          p_scheduled_time?: string
          p_timeframe_type: string
          p_walker_preference?: Database["public"]["Enums"]["walker_preference"]
        }
        Returns: string
      }
      generate_invite_code: { Args: never; Returns: string }
      generate_verification_code: { Args: never; Returns: string }
      get_assist_details: { Args: { t_assist_id: string }; Returns: Json }
      get_my_profile_id: { Args: never; Returns: string }
      get_neighborhood_feed: {
        Args: { filter_categories?: string[] }
        Returns: Json
      }
      get_profile_details: {
        Args: { target_id: string }
        Returns: {
          address: string
          display_name: string
          email: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_user_email_by_profile: {
        Args: { target_id: string }
        Returns: string
      }
      initialize_neighborhood: {
        Args: { neighborhood_name: string; user_lat: number; user_lng: number }
        Returns: string
      }
      join_neighborhood: {
        Args: { invite_code_text: string; user_lat: number; user_lng: number }
        Returns: Database["public"]["Enums"]["membership_status"]
      }
      request_vouch_handshake: { Args: never; Returns: string }
      start_assist: { Args: { p_assist_id: string }; Returns: undefined }
      update_assist_status: {
        Args: {
          t_assist_id: string
          t_new_status: Database["public"]["Enums"]["assist_status"]
        }
        Returns: undefined
      }
      verify_location_activation: {
        Args: { user_lat: number; user_lng: number }
        Returns: string
      }
      vouch_via_handshake: {
        Args: { entered_code: string }
        Returns: undefined
      }
    }
    Enums: {
      approval_mode: "must_approve" | "notify_after" | "independent"
      assist_status: "confirmed" | "in_progress" | "completed" | "cancelled"
      dog_size: "small" | "medium" | "large" | "extra_large"
      membership_status:
        | "pending_location"
        | "pending_second_vouch"
        | "active"
        | "inactive"
      offer_status: "pending" | "accepted" | "declined" | "cancelled"
      request_status: "active" | "filled" | "expired" | "cancelled" | "archived"
      user_role: "seeker" | "helper" | "caregiver" | "dependent"
      walker_preference: "no_preference" | "prefers_male" | "prefers_female"
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
      approval_mode: ["must_approve", "notify_after", "independent"],
      assist_status: ["confirmed", "in_progress", "completed", "cancelled"],
      dog_size: ["small", "medium", "large", "extra_large"],
      membership_status: [
        "pending_location",
        "pending_second_vouch",
        "active",
        "inactive",
      ],
      offer_status: ["pending", "accepted", "declined", "cancelled"],
      request_status: ["active", "filled", "expired", "cancelled", "archived"],
      user_role: ["seeker", "helper", "caregiver", "dependent"],
      walker_preference: ["no_preference", "prefers_male", "prefers_female"],
    },
  },
} as const
