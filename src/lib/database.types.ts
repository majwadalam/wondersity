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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          summary: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          summary: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          summary?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      attempts: {
        Row: {
          chosen: string
          correct: boolean
          created_at: string
          id: number
          learner_id: string
          lesson_id: number
          question_index: number
        }
        Insert: {
          chosen: string
          correct: boolean
          created_at?: string
          id?: never
          learner_id: string
          lesson_id: number
          question_index: number
        }
        Update: {
          chosen?: string
          correct?: boolean
          created_at?: string
          id?: never
          learner_id?: string
          lesson_id?: number
          question_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          learner_id: string
          topic: string
          topic_key: string
        }
        Insert: {
          created_at?: string
          learner_id: string
          topic: string
          topic_key: string
        }
        Update: {
          created_at?: string
          learner_id?: string
          topic?: string
          topic_key?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          accuracy: number | null
          completed_at: string
          course_id: number
          course_title: string
          created_at: string
          id: string
          learner_id: string
          learner_name: string
          lessons: number
          levels: Json
          minutes: number
          topic: string
        }
        Insert: {
          accuracy?: number | null
          completed_at: string
          course_id: number
          course_title: string
          created_at?: string
          id: string
          learner_id: string
          learner_name: string
          lessons: number
          levels?: Json
          minutes: number
          topic: string
        }
        Update: {
          accuracy?: number | null
          completed_at?: string
          course_id?: number
          course_title?: string
          created_at?: string
          id?: string
          learner_id?: string
          learner_name?: string
          lessons?: number
          levels?: Json
          minutes?: number
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      companions: {
        Row: {
          active: boolean
          blurb: string
          created_at: string
          partner_code: string
          slug: string
          title: string
          topic: string
          video_url: string | null
        }
        Insert: {
          active?: boolean
          blurb?: string
          created_at?: string
          partner_code: string
          slug: string
          title: string
          topic: string
          video_url?: string | null
        }
        Update: {
          active?: boolean
          blurb?: string
          created_at?: string
          partner_code?: string
          slug?: string
          title?: string
          topic?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companions_partner_code_fkey"
            columns: ["partner_code"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["code"]
          },
        ]
      }
      course_materials: {
        Row: {
          chunk_index: number
          content: string
          course_id: number
          created_at: string
          embedding: string | null
          id: number
          learner_id: string
          source: string
        }
        Insert: {
          chunk_index: number
          content: string
          course_id: number
          created_at?: string
          embedding?: string | null
          id?: never
          learner_id: string
          source: string
        }
        Update: {
          chunk_index?: number
          content?: string
          course_id?: number
          created_at?: string
          embedding?: string | null
          id?: never
          learner_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_plans: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string
          embedding: string | null
          first_lesson: Json | null
          first_lesson_score: number | null
          lesson_version: string | null
          modules: Json
          planner_version: string
          title: string
          topic: string
          topic_key: string
          updated_at: string
          world_road: Json | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description: string
          embedding?: string | null
          first_lesson?: Json | null
          first_lesson_score?: number | null
          lesson_version?: string | null
          modules: Json
          planner_version: string
          title: string
          topic: string
          topic_key: string
          updated_at?: string
          world_road?: Json | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string
          embedding?: string | null
          first_lesson?: Json | null
          first_lesson_score?: number | null
          lesson_version?: string | null
          modules?: Json
          planner_version?: string
          title?: string
          topic?: string
          topic_key?: string
          updated_at?: string
          world_road?: Json | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          archived_at: string | null
          cover_url: string | null
          created_at: string
          current_module: number
          description: string
          id: number
          intake: Json | null
          learner_id: string
          modules: Json
          outcomes: Json | null
          plan_key: string | null
          status: string
          title: string
          topic: string
          topic_key: string
          updated_at: string
          voices: Json
          world_road: Json | null
        }
        Insert: {
          archived_at?: string | null
          cover_url?: string | null
          created_at?: string
          current_module?: number
          description: string
          id?: never
          intake?: Json | null
          learner_id: string
          modules: Json
          outcomes?: Json | null
          plan_key?: string | null
          status?: string
          title: string
          topic: string
          topic_key: string
          updated_at?: string
          voices?: Json
          world_road?: Json | null
        }
        Update: {
          archived_at?: string | null
          cover_url?: string | null
          created_at?: string
          current_module?: number
          description?: string
          id?: never
          intake?: Json | null
          learner_id?: string
          modules?: Json
          outcomes?: Json | null
          plan_key?: string | null
          status?: string
          title?: string
          topic?: string
          topic_key?: string
          updated_at?: string
          voices?: Json
          world_road?: Json | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          intake: Json | null
          kind: string
          learner_id: string
          ref: string | null
          result: Json | null
          retryable: boolean | null
          status: string
          topic: string
          topic_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          intake?: Json | null
          kind: string
          learner_id: string
          ref?: string | null
          result?: Json | null
          retryable?: boolean | null
          status?: string
          topic: string
          topic_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          intake?: Json | null
          kind?: string
          learner_id?: string
          ref?: string | null
          result?: Json | null
          retryable?: boolean | null
          status?: string
          topic?: string
          topic_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_ratings: {
        Row: {
          comment: string | null
          created_at: string
          learner_id: string
          lesson_id: number
          rating: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          learner_id: string
          lesson_id: number
          rating: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          learner_id?: string
          lesson_id?: number
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ratings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reports: {
        Row: {
          created_at: string
          id: number
          kind: string
          learner_id: string
          lesson_id: number
          message: string
          step: number
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          learner_id: string
          lesson_id: number
          message?: string
          step: number
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          learner_id?: string
          lesson_id?: number
          message?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reports_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_views: {
        Row: {
          created_at: string
          id: number
          learner_id: string
          lesson_id: number
          step: number
          step_count: number
        }
        Insert: {
          created_at?: string
          id?: never
          learner_id: string
          lesson_id: number
          step: number
          step_count: number
        }
        Update: {
          created_at?: string
          id?: never
          learner_id?: string
          lesson_id?: number
          step?: number
          step_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_views_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          completed_at: string | null
          course_id: number | null
          created_at: string
          id: number
          learner_id: string
          lesson_data: Json
          module_index: number | null
          score: number | null
          topic: string
        }
        Insert: {
          completed_at?: string | null
          course_id?: number | null
          created_at?: string
          id?: never
          learner_id: string
          lesson_data: Json
          module_index?: number | null
          score?: number | null
          topic: string
        }
        Update: {
          completed_at?: string | null
          course_id?: number | null
          created_at?: string
          id?: never
          learner_id?: string
          lesson_data?: Json
          module_index?: number | null
          score?: number | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          href: string | null
          id: number
          kind: string
          learner_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          href?: string | null
          id?: never
          kind: string
          learner_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string | null
          id?: never
          kind?: string
          learner_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          active: boolean
          code: string
          commission_months: number
          commission_pct: number
          contact_email: string | null
          created_at: string
          discount_code: string | null
          name: string
          url: string | null
        }
        Insert: {
          active?: boolean
          code: string
          commission_months?: number
          commission_pct?: number
          contact_email?: string | null
          created_at?: string
          discount_code?: string | null
          name: string
          url?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          commission_months?: number
          commission_pct?: number
          contact_email?: string | null
          created_at?: string
          discount_code?: string | null
          name?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_confirmed_at: string | null
          avatar: string | null
          created_at: string
          daily_goal_minutes: number
          display_name: string | null
          id: string
          last_recap_on: string | null
          last_reminded_on: string | null
          onboarded_at: string | null
          reason: string | null
          referred_at: string | null
          referred_by: string | null
          reminders: boolean
          timezone: string | null
          updated_at: string
          voice_on: boolean
        }
        Insert: {
          age_confirmed_at?: string | null
          avatar?: string | null
          created_at?: string
          daily_goal_minutes?: number
          display_name?: string | null
          id: string
          last_recap_on?: string | null
          last_reminded_on?: string | null
          onboarded_at?: string | null
          reason?: string | null
          referred_at?: string | null
          referred_by?: string | null
          reminders?: boolean
          timezone?: string | null
          updated_at?: string
          voice_on?: boolean
        }
        Update: {
          age_confirmed_at?: string | null
          avatar?: string | null
          created_at?: string
          daily_goal_minutes?: number
          display_name?: string | null
          id?: string
          last_recap_on?: string | null
          last_reminded_on?: string | null
          onboarded_at?: string | null
          reason?: string | null
          referred_at?: string | null
          referred_by?: string | null
          reminders?: boolean
          timezone?: string | null
          updated_at?: string
          voice_on?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["code"]
          },
        ]
      }
      progress: {
        Row: {
          id: number
          last_lesson_id: number | null
          learner_id: string
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          id?: never
          last_lesson_id?: number | null
          learner_id: string
          status: string
          topic: string
          updated_at?: string
        }
        Update: {
          id?: never
          last_lesson_id?: number | null
          learner_id?: string
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_last_lesson_id_fkey"
            columns: ["last_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          learner_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          learner_id: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          learner_id?: string
          p256dh?: string
        }
        Relationships: []
      }
      review_clears: {
        Row: {
          cleared_at: string
          learner_id: string
          lesson_id: number
          question_index: number
        }
        Insert: {
          cleared_at?: string
          learner_id: string
          lesson_id: number
          question_index: number
        }
        Update: {
          cleared_at?: string
          learner_id?: string
          lesson_id?: number
          question_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_clears_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          calls: number
          cost_usd: number
          created_at: string
          error: string | null
          id: number
          kind: string
          learner_id: string
          lesson_id: number | null
          ms: number
          ok: boolean
          outcome: string | null
          tokens_in: number
          tokens_out: number
          topic: string | null
          trace: Json
        }
        Insert: {
          calls?: number
          cost_usd?: number
          created_at?: string
          error?: string | null
          id?: never
          kind: string
          learner_id: string
          lesson_id?: number | null
          ms: number
          ok: boolean
          outcome?: string | null
          tokens_in?: number
          tokens_out?: number
          topic?: string | null
          trace?: Json
        }
        Update: {
          calls?: number
          cost_usd?: number
          created_at?: string
          error?: string | null
          id?: never
          kind?: string
          learner_id?: string
          lesson_id?: number | null
          ms?: number
          ok?: boolean
          outcome?: string | null
          tokens_in?: number
          tokens_out?: number
          topic?: string | null
          trace?: Json
        }
        Relationships: [
          {
            foreignKeyName: "runs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_lessons: {
        Row: {
          created_at: string
          lesson: Json
          lesson_version: string
          module_index: number
          plan_key: string
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          lesson: Json
          lesson_version: string
          module_index: number
          plan_key: string
          score: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          lesson?: Json
          lesson_version?: string
          module_index?: number
          plan_key?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_lessons_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "course_plans"
            referencedColumns: ["topic_key"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          current_period_end: string | null
          learner_id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          plan: string
          price_id: string
          referred_by: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          current_period_end?: string | null
          learner_id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          plan: string
          price_id: string
          referred_by?: string | null
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          current_period_end?: string | null
          learner_id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          plan?: string
          price_id?: string
          referred_by?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["code"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          email: string | null
          id: number
          kind: string
          learner_id: string | null
          message: string
          page: string | null
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          kind: string
          learner_id?: string | null
          message: string
          page?: string | null
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          kind?: string
          learner_id?: string | null
          message?: string
          page?: string | null
          resolved_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_browser_learner: { Args: { old_id: string }; Returns: number }
      match_course_materials: {
        Args: { course: number; max_results?: number; query: string }
        Returns: {
          chunk_index: number
          content: string
          similarity: number
          source: string
        }[]
      }
      match_course_plans: {
        Args: { max_results?: number; query: string; version: string }
        Returns: {
          description: string
          similarity: number
          title: string
          topic: string
          topic_key: string
        }[]
      }
      preview_browser_learner: {
        Args: { old_id: string }
        Returns: {
          title: string
          topic: string
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
