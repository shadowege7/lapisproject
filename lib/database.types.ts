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
          /** The Launchpad's "has this person left" flag. Read here so a
           *  departed employee stops receiving store report emails. */
          is_active: boolean;
          full_name: string | null;
          first_name: string | null;
          /** What they go by, if different from first_name. */
          preferred_name: string | null;
          last_name: string | null;
          is_super_admin: boolean;
          /** May set monthly unit budgets. Super admins always may. */
          can_edit_budgets: boolean;
          notifications_enabled: boolean;
          position_id: string | null;
          main_dealership_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          must_change_password?: boolean;
          is_active?: boolean;
          full_name?: string | null;
          first_name?: string | null;
          preferred_name?: string | null;
          last_name?: string | null;
          is_super_admin?: boolean;
          can_edit_budgets?: boolean;
          notifications_enabled?: boolean;
          position_id?: string | null;
          main_dealership_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          must_change_password?: boolean;
          is_active?: boolean;
          full_name?: string | null;
          first_name?: string | null;
          preferred_name?: string | null;
          last_name?: string | null;
          is_super_admin?: boolean;
          can_edit_budgets?: boolean;
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
          /** Hand-set dashboard order. Null sorts last, then by name. */
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tracks_sprinters?: boolean;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tracks_sprinters?: boolean;
          sort_order?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      // Mail server for the daily report. service_role only — the table has no
      // RLS policies and no grants to `authenticated`, so nothing reachable
      // from a browser can read the password. See 0017 in the Launchpad repo.
      smtp_settings: {
        Row: {
          only_row: boolean;
          host: string | null;
          port: number;
          username: string | null;
          password: string | null;
          mail_from: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          only_row?: boolean;
          host?: string | null;
          port?: number;
          username?: string | null;
          password?: string | null;
          mail_from?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          only_row?: boolean;
          host?: string | null;
          port?: number;
          username?: string | null;
          password?: string | null;
          mail_from?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      // Monthly unit goals per store. Units only — no gross. One row per
      // store per month; see 0018 in the Launchpad repo.
      store_budgets: {
        Row: {
          dealership_id: string;
          /** Always the first of the month. */
          month: string;
          new_units: number;
          used_units: number;
          sprinter_units: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          dealership_id: string;
          month: string;
          new_units?: number;
          used_units?: number;
          sprinter_units?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          dealership_id?: string;
          month?: string;
          new_units?: number;
          used_units?: number;
          sprinter_units?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      // Who gets emailed a store's numbers when they are saved. Kept apart
      // from dealership_members on purpose — see 0016 in the Launchpad repo.
      daily_report_recipients: {
        Row: {
          dealership_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          dealership_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          dealership_id?: string;
          profile_id?: string;
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
          sales_calls: number;
          appointments: number;
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
          sales_calls?: number;
          appointments?: number;
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
          sales_calls?: number;
          appointments?: number;
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
      get_dashboard_rollup: {
        Args: { p_month: string; p_today: string };
        // Returns { rollup: {...totals}, leaderboard: [...] } or null when the
        // caller is not entitled. Shaped by the page, so typed loosely here.
        Returns: {
          rollup: {
            todayGross: number;
            mtdGross: number;
            todayNew: number;
            todayUsed: number;
            todaySprinter: number;
            mtdNew: number;
            mtdUsed: number;
            mtdSprinter: number;
          };
          leaderboard: {
            name: string;
            gross: number;
            newUnits: number;
            usedUnits: number;
          }[];
        } | null;
      };
    };
    Enums: {
      dealership_role: DealershipRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
