export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      associations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_starred: boolean;
          sort_order: number;
          text: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_starred?: boolean;
          sort_order?: number;
          text: string;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_starred?: boolean;
          sort_order?: number;
          text?: string;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'associations_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topic_stats';
            referencedColumns: ['topic_id', 'user_id'];
          },
          {
            foreignKeyName: 'associations_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          last_location: Json | null;
          preferences: NonNullable<Json>;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          last_location?: Json | null;
          preferences?: NonNullable<Json>;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_location?: Json | null;
          preferences?: NonNullable<Json>;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      setups: {
        Row: {
          archived_at: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_favorite: boolean;
          notes: string;
          parent_setup_id: string | null;
          sort_order: number;
          status: Database['public']['Enums']['setup_status'];
          text: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_favorite?: boolean;
          notes?: string;
          parent_setup_id?: string | null;
          sort_order?: number;
          status?: Database['public']['Enums']['setup_status'];
          text?: string;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_favorite?: boolean;
          notes?: string;
          parent_setup_id?: string | null;
          sort_order?: number;
          status?: Database['public']['Enums']['setup_status'];
          text?: string;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'setups_parent_setup_id_fkey';
            columns: ['parent_setup_id'];
            isOneToOne: false;
            referencedRelation: 'setups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'setups_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topic_stats';
            referencedColumns: ['topic_id', 'user_id'];
          },
          {
            foreignKeyName: 'setups_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      topics: {
        Row: {
          archived_at: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string;
          id: string;
          is_favorite: boolean;
          last_activity_at: string;
          notes: string;
          status: Database['public']['Enums']['topic_status'];
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          is_favorite?: boolean;
          last_activity_at?: string;
          notes?: string;
          status?: Database['public']['Enums']['topic_status'];
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          is_favorite?: boolean;
          last_activity_at?: string;
          notes?: string;
          status?: Database['public']['Enums']['topic_status'];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      topic_stats: {
        Row: {
          association_count: number | null;
          description: string;
          is_favorite: boolean;
          last_activity_at: string;
          setup_count: number | null;
          status: Database['public']['Enums']['topic_status'];
          title: string;
          topic_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          association_count?: never;
          description?: string | null;
          is_favorite?: boolean | null;
          last_activity_at?: string | null;
          setup_count?: never;
          status?: Database['public']['Enums']['topic_status'] | null;
          title?: string | null;
          topic_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          association_count?: never;
          description?: string | null;
          is_favorite?: boolean | null;
          last_activity_at?: string | null;
          setup_count?: never;
          status?: Database['public']['Enums']['topic_status'] | null;
          title?: string | null;
          topic_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      setup_status: 'active' | 'archived';
      topic_status: 'active' | 'archived';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      setup_status: ['active', 'archived'],
      topic_status: ['active', 'archived'],
    },
  },
} as const;
