// Minimal Database type compatible with @supabase/postgrest-js GenericSchema.
// Replace with `supabase gen types typescript --project-id <ref>` output later.

export type Role = "owner" | "manager" | "staff";
export type ProgressStatus = "not_started" | "in_progress" | "completed";

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          phone: string | null;
          timezone: string;
          stripe_customer_id: string | null;
          plan: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          phone?: string | null;
          timezone?: string;
          stripe_customer_id?: string | null;
          plan?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          store_id: string;
          email: string;
          full_name: string | null;
          role: Role;
          expo_push_token: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          store_id: string;
          email: string;
          full_name?: string | null;
          role?: Role;
          expo_push_token?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "users_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_store_for_current_user: {
        Args: {
          p_store_name: string;
          p_full_name?: string | null;
          p_phone?: string | null;
          p_timezone?: string | null;
        };
        Returns: string;
      };
    };
  };
}
