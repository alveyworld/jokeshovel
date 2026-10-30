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
      assumptions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          setup_id: string;
          sort_order: number;
          text: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          setup_id: string;
          sort_order?: number;
          text: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          setup_id?: string;
          sort_order?: number;
          text?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assumptions_setup_id_user_id_fkey';
            columns: ['setup_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'setups';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      google_connections: {
        Row: {
          connected_at: string;
          google_email: string | null;
          google_sub: string | null;
          granted_scopes: string[];
          joke_book_file_id: string | null;
          last_error: string | null;
          refresh_token_ciphertext: string;
          status: Database['public']['Enums']['google_connection_status'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          connected_at?: string;
          google_email?: string | null;
          google_sub?: string | null;
          granted_scopes?: string[];
          joke_book_file_id?: string | null;
          last_error?: string | null;
          refresh_token_ciphertext: string;
          status?: Database['public']['Enums']['google_connection_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connected_at?: string;
          google_email?: string | null;
          google_sub?: string | null;
          granted_scopes?: string[];
          joke_book_file_id?: string | null;
          last_error?: string | null;
          refresh_token_ciphertext?: string;
          status?: Database['public']['Enums']['google_connection_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      joke_attempts: {
        Row: {
          completed_at: string | null;
          connector: string;
          connector_note: string;
          created_at: string;
          current_step: Database['public']['Enums']['attempt_step'];
          deleted_at: string | null;
          id: string;
          last_step_at: string;
          notes: string;
          punch: string;
          second_story: string;
          selected_reinterpretation_id: string | null;
          setup_id: string;
          started_at: string;
          status: Database['public']['Enums']['attempt_status'];
          target_assumption_id: string | null;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          connector?: string;
          connector_note?: string;
          created_at?: string;
          current_step?: Database['public']['Enums']['attempt_step'];
          deleted_at?: string | null;
          id?: string;
          last_step_at?: string;
          notes?: string;
          punch?: string;
          second_story?: string;
          selected_reinterpretation_id?: string | null;
          setup_id: string;
          started_at?: string;
          status?: Database['public']['Enums']['attempt_status'];
          target_assumption_id?: string | null;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          connector?: string;
          connector_note?: string;
          created_at?: string;
          current_step?: Database['public']['Enums']['attempt_step'];
          deleted_at?: string | null;
          id?: string;
          last_step_at?: string;
          notes?: string;
          punch?: string;
          second_story?: string;
          selected_reinterpretation_id?: string | null;
          setup_id?: string;
          started_at?: string;
          status?: Database['public']['Enums']['attempt_status'];
          target_assumption_id?: string | null;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'joke_attempts_selected_reinterpretation_fkey';
            columns: ['selected_reinterpretation_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'reinterpretations';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'joke_attempts_setup_id_user_id_fkey';
            columns: ['setup_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'setups';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'joke_attempts_target_assumption_id_user_id_fkey';
            columns: ['target_assumption_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'assumptions';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'joke_attempts_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topic_stats';
            referencedColumns: ['topic_id', 'user_id'];
          },
          {
            foreignKeyName: 'joke_attempts_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      jokes: {
        Row: {
          archived_at: string | null;
          attempt_id: string | null;
          completed_at: string;
          connector_text: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_favorite: boolean;
          notes: string;
          punch_text: string;
          rating: number | null;
          reinterpretation_text: string;
          second_story_text: string;
          setup_id: string | null;
          setup_text: string;
          status: Database['public']['Enums']['joke_status'];
          target_assumption_text: string;
          title: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          attempt_id?: string | null;
          completed_at?: string;
          connector_text?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_favorite?: boolean;
          notes?: string;
          punch_text: string;
          rating?: number | null;
          reinterpretation_text?: string;
          second_story_text?: string;
          setup_id?: string | null;
          setup_text: string;
          status?: Database['public']['Enums']['joke_status'];
          target_assumption_text?: string;
          title?: string;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          attempt_id?: string | null;
          completed_at?: string;
          connector_text?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_favorite?: boolean;
          notes?: string;
          punch_text?: string;
          rating?: number | null;
          reinterpretation_text?: string;
          second_story_text?: string;
          setup_id?: string | null;
          setup_text?: string;
          status?: Database['public']['Enums']['joke_status'];
          target_assumption_text?: string;
          title?: string;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'jokes_attempt_id_user_id_fkey';
            columns: ['attempt_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'drafts_feed';
            referencedColumns: ['attempt_id', 'user_id'];
          },
          {
            foreignKeyName: 'jokes_attempt_id_user_id_fkey';
            columns: ['attempt_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'joke_attempts';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'jokes_setup_id_user_id_fkey';
            columns: ['setup_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'setups';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'jokes_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topic_stats';
            referencedColumns: ['topic_id', 'user_id'];
          },
          {
            foreignKeyName: 'jokes_topic_id_user_id_fkey';
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
      publications: {
        Row: {
          attempt_count: number;
          body: string;
          client_request_id: string;
          completed_at: string | null;
          created_at: string;
          destination: Database['public']['Enums']['publication_destination'];
          error_code: string | null;
          error_message: string | null;
          external_id: string | null;
          external_url: string | null;
          id: string;
          include_options: NonNullable<Json>;
          joke_id: string;
          method: Database['public']['Enums']['publication_method'];
          requested_at: string;
          status: Database['public']['Enums']['publication_status'];
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          body: string;
          client_request_id: string;
          completed_at?: string | null;
          created_at?: string;
          destination: Database['public']['Enums']['publication_destination'];
          error_code?: string | null;
          error_message?: string | null;
          external_id?: string | null;
          external_url?: string | null;
          id?: string;
          include_options?: NonNullable<Json>;
          joke_id: string;
          method: Database['public']['Enums']['publication_method'];
          requested_at?: string;
          status?: Database['public']['Enums']['publication_status'];
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          attempt_count?: number;
          body?: string;
          client_request_id?: string;
          completed_at?: string | null;
          created_at?: string;
          destination?: Database['public']['Enums']['publication_destination'];
          error_code?: string | null;
          error_message?: string | null;
          external_id?: string | null;
          external_url?: string | null;
          id?: string;
          include_options?: NonNullable<Json>;
          joke_id?: string;
          method?: Database['public']['Enums']['publication_method'];
          requested_at?: string;
          status?: Database['public']['Enums']['publication_status'];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'publications_joke_id_user_id_fkey';
            columns: ['joke_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'jokes';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      reinterpretations: {
        Row: {
          attempt_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_starred: boolean;
          sort_order: number;
          text: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_starred?: boolean;
          sort_order?: number;
          text: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          attempt_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_starred?: boolean;
          sort_order?: number;
          text?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reinterpretations_attempt_id_user_id_fkey';
            columns: ['attempt_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'drafts_feed';
            referencedColumns: ['attempt_id', 'user_id'];
          },
          {
            foreignKeyName: 'reinterpretations_attempt_id_user_id_fkey';
            columns: ['attempt_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'joke_attempts';
            referencedColumns: ['id', 'user_id'];
          },
        ];
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
      drafts_feed: {
        Row: {
          attempt_id: string;
          current_step: Database['public']['Enums']['attempt_step'];
          last_step_at: string;
          setup_id: string;
          setup_text: string;
          target_text: string | null;
          topic_id: string;
          topic_title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'joke_attempts_setup_id_user_id_fkey';
            columns: ['setup_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'setups';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'joke_attempts_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topic_stats';
            referencedColumns: ['topic_id', 'user_id'];
          },
          {
            foreignKeyName: 'joke_attempts_topic_id_user_id_fkey';
            columns: ['topic_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      topic_stats: {
        Row: {
          association_count: number | null;
          completed_joke_count: number | null;
          completion_percent: number | null;
          description: string;
          is_favorite: boolean;
          last_activity_at: string;
          published_to_docs_count: number | null;
          published_to_keep_count: number | null;
          setup_count: number | null;
          setups_with_joke_count: number | null;
          status: Database['public']['Enums']['topic_status'];
          title: string;
          topic_id: string;
          unfinished_attempt_count: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      complete_attempt: {
        Args: { p_attempt_id: string; p_title?: string };
        Returns: {
          archived_at: string | null;
          attempt_id: string | null;
          completed_at: string;
          connector_text: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_favorite: boolean;
          notes: string;
          punch_text: string;
          rating: number | null;
          reinterpretation_text: string;
          second_story_text: string;
          setup_id: string | null;
          setup_text: string;
          status: Database['public']['Enums']['joke_status'];
          target_assumption_text: string;
          title: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'jokes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_publication: {
        Args: { p_id: string; p_saved: boolean };
        Returns: {
          attempt_count: number;
          body: string;
          client_request_id: string;
          completed_at: string | null;
          created_at: string;
          destination: Database['public']['Enums']['publication_destination'];
          error_code: string | null;
          error_message: string | null;
          external_id: string | null;
          external_url: string | null;
          id: string;
          include_options: NonNullable<Json>;
          joke_id: string;
          method: Database['public']['Enums']['publication_method'];
          requested_at: string;
          status: Database['public']['Enums']['publication_status'];
          title: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'publications';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      search_all: {
        Args: { q: string };
        Returns: {
          id: string;
          kind: string;
          score: number;
          snippet: string;
          title: string;
          topic_id: string;
          topic_title: string;
        }[];
      };
      start_publication: {
        Args: {
          p_body: string;
          p_client_request_id: string;
          p_include: Json;
          p_joke_id: string;
          p_method: Database['public']['Enums']['publication_method'];
          p_title: string;
        };
        Returns: {
          attempt_count: number;
          body: string;
          client_request_id: string;
          completed_at: string | null;
          created_at: string;
          destination: Database['public']['Enums']['publication_destination'];
          error_code: string | null;
          error_message: string | null;
          external_id: string | null;
          external_url: string | null;
          id: string;
          include_options: NonNullable<Json>;
          joke_id: string;
          method: Database['public']['Enums']['publication_method'];
          requested_at: string;
          status: Database['public']['Enums']['publication_status'];
          title: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'publications';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      attempt_status: 'in_progress' | 'completed' | 'abandoned' | 'archived';
      attempt_step: 'target' | 'connector' | 'reinterpretations' | 'choose' | 'second_story' | 'punch' | 'review';
      google_connection_status: 'active' | 'revoked' | 'error';
      joke_status: 'complete' | 'archived';
      publication_destination: 'google_keep' | 'google_docs' | 'markdown';
      publication_method: 'share_sheet' | 'copy_open' | 'docs_api' | 'download';
      publication_status: 'pending' | 'succeeded' | 'failed' | 'user_confirmed' | 'cancelled';
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
      attempt_status: ['in_progress', 'completed', 'abandoned', 'archived'],
      attempt_step: ['target', 'connector', 'reinterpretations', 'choose', 'second_story', 'punch', 'review'],
      google_connection_status: ['active', 'revoked', 'error'],
      joke_status: ['complete', 'archived'],
      publication_destination: ['google_keep', 'google_docs', 'markdown'],
      publication_method: ['share_sheet', 'copy_open', 'docs_api', 'download'],
      publication_status: ['pending', 'succeeded', 'failed', 'user_confirmed', 'cancelled'],
      setup_status: ['active', 'archived'],
      topic_status: ['active', 'archived'],
    },
  },
} as const;
