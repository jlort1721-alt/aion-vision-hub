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
      access_logs: {
        Row: {
          created_at: string
          direction: string
          id: string
          method: string
          notes: string | null
          operator_id: string | null
          person_id: string | null
          section_id: string | null
          tenant_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          id?: string
          method?: string
          notes?: string | null
          operator_id?: string | null
          person_id?: string | null
          section_id?: string | null
          tenant_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          method?: string
          notes?: string | null
          operator_id?: string | null
          person_id?: string | null
          section_id?: string | null
          tenant_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "access_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "access_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_people: {
        Row: {
          created_at: string
          document_id: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          section_id: string | null
          status: string
          tenant_id: string
          type: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          section_id?: string | null
          status?: string
          tenant_id: string
          type?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          section_id?: string | null
          status?: string
          tenant_id?: string
          type?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_people_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      access_vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          id: string
          model: string | null
          person_id: string | null
          plate: string
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          model?: string | null
          person_id?: string | null
          plate: string
          status?: string
          tenant_id: string
          type?: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          model?: string | null
          person_id?: string | null
          plate?: string
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_vehicles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "access_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string
          estimated_cost: number
          id: string
          messages: Json
          model: string
          provider: string
          tenant_id: string
          total_tokens: number
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          estimated_cost?: number
          id?: string
          messages?: Json
          model?: string
          provider?: string
          tenant_id: string
          total_tokens?: number
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          estimated_cost?: number
          id?: string
          messages?: Json
          model?: string
          provider?: string
          tenant_id?: string
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          tenant_id: string
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          tenant_id: string
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      database_records: {
        Row: {
          category: string
          content: Json
          created_at: string
          created_by: string
          id: string
          section_id: string | null
          status: string
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: Json
          created_at?: string
          created_by: string
          id?: string
          section_id?: string | null
          status?: string
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          section_id?: string | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "database_records_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "database_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      device_groups: {
        Row: {
          description: string | null
          id: string
          name: string
          site_id: string
          tenant_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          site_id: string
          tenant_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          site_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_groups_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          brand: string
          capabilities: Json
          channels: number
          created_at: string
          firmware_version: string | null
          group_id: string | null
          http_port: number | null
          id: string
          ip_address: string
          last_seen: string | null
          mac_address: string | null
          model: string
          name: string
          notes: string | null
          onvif_port: number | null
          port: number
          rtsp_port: number | null
          serial_number: string | null
          site_id: string
          status: string
          tags: string[] | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          brand?: string
          capabilities?: Json
          channels?: number
          created_at?: string
          firmware_version?: string | null
          group_id?: string | null
          http_port?: number | null
          id?: string
          ip_address: string
          last_seen?: string | null
          mac_address?: string | null
          model?: string
          name: string
          notes?: string | null
          onvif_port?: number | null
          port?: number
          rtsp_port?: number | null
          serial_number?: string | null
          site_id: string
          status?: string
          tags?: string[] | null
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          brand?: string
          capabilities?: Json
          channels?: number
          created_at?: string
          firmware_version?: string | null
          group_id?: string | null
          http_port?: number | null
          id?: string
          ip_address?: string
          last_seen?: string | null
          mac_address?: string | null
          model?: string
          name?: string
          notes?: string | null
          onvif_port?: number | null
          port?: number
          rtsp_port?: number | null
          serial_number?: string | null
          site_id?: string
          status?: string
          tags?: string[] | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domotic_actions: {
        Row: {
          action: string
          created_at: string
          device_id: string
          id: string
          result: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          device_id: string
          id?: string
          result?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          device_id?: string
          id?: string
          result?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domotic_actions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "domotic_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domotic_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domotic_devices: {
        Row: {
          brand: string
          config: Json
          created_at: string
          id: string
          last_action: string | null
          last_sync: string | null
          model: string
          name: string
          section_id: string | null
          state: string
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          brand?: string
          config?: Json
          created_at?: string
          id?: string
          last_action?: string | null
          last_sync?: string | null
          model?: string
          name: string
          section_id?: string | null
          state?: string
          status?: string
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          brand?: string
          config?: Json
          created_at?: string
          id?: string
          last_action?: string | null
          last_sync?: string | null
          model?: string
          name?: string
          section_id?: string | null
          state?: string
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domotic_devices_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domotic_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          ai_summary: string | null
          assigned_to: string | null
          channel: number | null
          clip_url: string | null
          created_at: string
          description: string | null
          device_id: string
          event_type: string
          id: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          site_id: string
          snapshot_url: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_to?: string | null
          channel?: number | null
          clip_url?: string | null
          created_at?: string
          description?: string | null
          device_id: string
          event_type: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          site_id: string
          snapshot_url?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_to?: string | null
          channel?: number | null
          clip_url?: string | null
          created_at?: string
          description?: string | null
          device_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          site_id?: string
          snapshot_url?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          name: string
          tenant_override: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          name: string
          tenant_override?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          tenant_override?: Json | null
        }
        Relationships: []
      }
      incidents: {
        Row: {
          ai_summary: string | null
          assigned_to: string | null
          closed_at: string | null
          comments: Json
          created_at: string
          created_by: string
          description: string
          event_ids: string[] | null
          evidence_urls: string[] | null
          id: string
          priority: string
          site_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          comments?: Json
          created_at?: string
          created_by: string
          description?: string
          event_ids?: string[] | null
          evidence_urls?: string[] | null
          id?: string
          priority?: string
          site_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          comments?: Json
          created_at?: string
          created_by?: string
          description?: string
          event_ids?: string[] | null
          evidence_urls?: string[] | null
          id?: string
          priority?: string
          site_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          error_message: string | null
          id: string
          last_sync: string | null
          name: string
          provider: string
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync?: string | null
          name: string
          provider: string
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync?: string | null
          name?: string
          provider?: string
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intercom_calls: {
        Row: {
          attended_by: string
          created_at: string
          device_id: string | null
          direction: string
          duration_seconds: number | null
          id: string
          notes: string | null
          section_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          attended_by?: string
          created_at?: string
          device_id?: string | null
          direction?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          section_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          attended_by?: string
          created_at?: string
          device_id?: string | null
          direction?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          section_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercom_calls_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "intercom_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercom_calls_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercom_calls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intercom_devices: {
        Row: {
          brand: string
          config: Json
          created_at: string
          id: string
          ip_address: string | null
          model: string
          name: string
          section_id: string | null
          sip_uri: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand?: string
          config?: Json
          created_at?: string
          id?: string
          ip_address?: string | null
          model?: string
          name: string
          section_id?: string | null
          sip_uri?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand?: string
          config?: Json
          created_at?: string
          id?: string
          ip_address?: string | null
          model?: string
          name?: string
          section_id?: string | null
          sip_uri?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercom_devices_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercom_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_view_layouts: {
        Row: {
          created_at: string
          grid: number
          id: string
          is_favorite: boolean
          is_shared: boolean
          name: string
          slots: Json
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grid?: number
          id?: string
          is_favorite?: boolean
          is_shared?: boolean
          name: string
          slots?: Json
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          grid?: number
          id?: string
          is_favorite?: boolean
          is_shared?: boolean
          name?: string
          slots?: Json
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_view_layouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connectors: {
        Row: {
          config: Json
          created_at: string
          endpoint: string | null
          error_count: number
          health: string
          id: string
          last_check: string | null
          name: string
          scopes: string[] | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          endpoint?: string | null
          error_count?: number
          health?: string
          id?: string
          last_check?: string | null
          name: string
          scopes?: string[] | null
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          endpoint?: string | null
          error_count?: number
          health?: string
          id?: string
          last_check?: string | null
          name?: string
          scopes?: string[] | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_connectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      playback_requests: {
        Row: {
          channel: number
          created_at: string
          created_by: string
          device_id: string
          end_time: string
          id: string
          output_url: string | null
          start_time: string
          status: string
          tenant_id: string
        }
        Insert: {
          channel?: number
          created_at?: string
          created_by: string
          device_id: string
          end_time: string
          id?: string
          output_url?: string | null
          start_time: string
          status?: string
          tenant_id: string
        }
        Update: {
          channel?: number
          created_at?: string
          created_by?: string
          device_id?: string
          end_time?: string
          id?: string
          output_url?: string | null
          start_time?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playback_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys?: Json
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reboot_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          device_id: string | null
          id: string
          initiated_by: string
          reason: string
          recovery_time_seconds: number | null
          result: string | null
          section_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          initiated_by: string
          reason?: string
          recovery_time_seconds?: number | null
          result?: string | null
          section_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          initiated_by?: string
          reason?: string
          recovery_time_seconds?: number | null
          result?: string | null
          section_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reboot_tasks_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reboot_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reboot_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          enabled: boolean
          id: string
          module: string
          role: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          module: string
          role: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          module?: string
          role?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          site_id: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          site_id?: string | null
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          site_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          status: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          status?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          status?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          bitrate: number | null
          channel: number
          codec: string
          device_id: string
          fps: number
          id: string
          is_active: boolean
          protocol: string
          resolution: string
          type: string
          url_template: string
        }
        Insert: {
          bitrate?: number | null
          channel?: number
          codec?: string
          device_id: string
          fps?: number
          id?: string
          is_active?: boolean
          protocol?: string
          resolution?: string
          type?: string
          url_template?: string
        }
        Update: {
          bitrate?: number | null
          channel?: number
          codec?: string
          device_id?: string
          fps?: number
          id?: string
          is_active?: boolean
          protocol?: string
          resolution?: string
          type?: string
          url_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "streams_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "tenant_admin"
        | "operator"
        | "viewer"
        | "auditor"
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
      app_role: [
        "super_admin",
        "tenant_admin",
        "operator",
        "viewer",
        "auditor",
      ],
    },
  },
} as const
