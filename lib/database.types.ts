// Hand-written to match supabase/migrations/0001_init.sql.
// Once the Supabase project exists, prefer regenerating this with:
//   npx supabase gen types typescript --project-id <ref> > lib/database.types.ts

export type DealershipRole = "editor" | "viewer";

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          value: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // Shared with the Launchpad, which owns several columns this app never
      // touches. `email` is kept in step with auth.users by a trigger — see
      // 0014_sync_profile_email.sql in the Launchpad repo — so nothing here
      // should write it directly.
      profiles: {
        Row: {
          id: string;
          email: string;
          /** Enforced by the Launchpad's /set-password gate, not by this app. */
          must_change_password: boolean;
          full_name: string | null;
          first_name: string | null;
          /** What they go by, if different from first_name. */
          preferred_name: string | null;
          last_name: string | null;
          is_super_admin: boolean;
          notifications_enabled: boolean;
          position_id: string | null;
          main_dealership_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          must_change_password?: boolean;
          full_name?: string | null;
          first_name?: string | null;
          preferred_name?: string | null;
          last_name?: string | null;
          is_super_admin?: boolean;
          notifications_enabled?: boolean;
          position_id?: string | null;
          main_dealership_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          must_change_password?: boolean;
          full_name?: string | null;
          first_name?: string | null;
          preferred_name?: string | null;
          last_name?: string | null;
          is_super_admin?: boolean;
          notifications_enabled?: boolean;
          position_id?: string | null;
          main_dealership_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      positions: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          can_view_rollup: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          can_view_rollup?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          can_view_rollup?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dealerships: {
        Row: {
          id: string;
          name: string;
          /** Whether this store sells Sprinter vans and reports them apart. */
          tracks_sprinters: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tracks_sprinters?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tracks_sprinters?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      dealership_members: {
        Row: {
          id: string;
          dealership_id: string;
          user_id: string;
          role: DealershipRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          user_id: string;
          role: DealershipRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          user_id?: string;
          role?: DealershipRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dealership_members_dealership_id_fkey";
            columns: ["dealership_id"];
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dealership_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_entries: {
        Row: {
          id: string;
          dealership_id: string;
          entry_date: string;
          new_units: number;
          used_units: number;
          /** Only meaningful where dealerships.tracks_sprinters is set. */
          sprinter_units: number;
          new_front_end_gross: number;
          new_back_end_gross: number;
          used_front_end_gross: number;
          used_back_end_gross: number;
          sprinter_front_end_gross: number;
          sprinter_back_end_gross: number;
          manager_calls: number;
          sales_calls: number;
          appointments: number;
          confirmed_appointments: number;
          notes: string | null;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          entry_date: string;
          new_units: number;
          used_units: number;
          sprinter_units?: number;
          new_front_end_gross: number;
          new_back_end_gross: number;
          used_front_end_gross: number;
          used_back_end_gross: number;
          sprinter_front_end_gross?: number;
          sprinter_back_end_gross?: number;
          manager_calls?: number;
          sales_calls?: number;
          appointments?: number;
          confirmed_appointments?: number;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          entry_date?: string;
          new_units?: number;
          used_units?: number;
          sprinter_units?: number;
          new_front_end_gross?: number;
          new_back_end_gross?: number;
          used_front_end_gross?: number;
          used_back_end_gross?: number;
          sprinter_front_end_gross?: number;
          sprinter_back_end_gross?: number;
          manager_calls?: number;
          sales_calls?: number;
          appointments?: number;
          confirmed_appointments?: number;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_entries_dealership_id_fkey";
            columns: ["dealership_id"];
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      monthly_summary: {
        Row: {
          dealership_id: string;
          month: string;
          total_new_units: number;
          total_used_units: number;
          total_sprinter_units: number;
          total_new_front_end_gross: number;
          total_new_back_end_gross: number;
          total_used_front_end_gross: number;
          total_used_back_end_gross: number;
          total_sprinter_front_end_gross: number;
          total_sprinter_back_end_gross: number;
          total_front_end_gross: number;
          total_back_end_gross: number;
          total_gross: number;
          days_logged: number;
        };
        Relationships: [];
      };
      annual_summary: {
        Row: {
          dealership_id: string;
          year: string;
          total_new_units: number;
          total_used_units: number;
          total_sprinter_units: number;
          total_new_front_end_gross: number;
          total_new_back_end_gross: number;
          total_used_front_end_gross: number;
          total_used_back_end_gross: number;
          total_sprinter_front_end_gross: number;
          total_sprinter_back_end_gross: number;
          total_front_end_gross: number;
          total_back_end_gross: number;
          total_gross: number;
          days_logged: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      dealership_role: {
        Args: { target_dealership: string };
        Returns: DealershipRole | null;
      };
    };
    Enums: {
      dealership_role: DealershipRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
