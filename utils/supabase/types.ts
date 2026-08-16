export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: string;
          initials: string;
          major: string | null;
          created_at: number;
        };
        Insert: Partial<{ id: string; role: string; initials: string; major: string | null }> &
          Pick<{ email: string; name: string }, 'email' | 'name'>;
        Update: {
          name?: string;
          role?: string;
          initials?: string;
          major?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_email: string;
          author_name: string;
          author_initials: string;
          author_role: string;
          content: string;
          image: string | null;
          tags: Json;
          status: string;
          ai_flags: string | null;
          moderation_note: string | null;
          created_at: number;
          updated_at: number;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          item_status: string | null;
          item_location: string | null;
        };
        Insert: Pick<
          {
            author_email: string;
            author_name: string;
            author_initials: string;
            author_role: string;
          },
          'author_email' | 'author_name' | 'author_initials' | 'author_role'
        > &
          Partial<{ image: string; tags: Json; status: string; shares_count?: number; item_status?: string | null; item_location?: string | null } & Pick<{ content: string }, 'content'>>;
        Update: {
          content?: string;
          image?: string | null;
          tags?: Json;
          status?: string;
          ai_flags?: string | null;
          moderation_note?: string | null;
          updated_at?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          item_status?: string | null;
          item_location?: string | null;
        };
        Relationships: [];
      };
      post_likes: {
        Row: { id: string; post_id: string; user_email: string; created_at: number };
        Insert: { post_id: string; user_email: string };
        Update: { post_id?: string; user_email?: string; created_at?: number | null };
        Relationships: [];
      };
      post_shares: {
        Row: {
          id: string;
          post_id: string;
          sharer_email: string;
          sharer_name: string;
          recipients: Json;
          created_at: number;
        };
        Insert: {
          post_id: string;
          sharer_email: string;
          sharer_name: string;
          recipients?: Json | null;
          created_at?: number | null;
        };
        Update: { recipients?: Json | null };
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_email: string;
          author_name: string;
          author_initials: string;
          content: string;
          created_at: number;
          updated_at: number;
          deleted_at: number | null;
        };
        Insert: Pick<
          {
            post_id: string;
            author_email: string;
            author_name: string;
            author_initials: string;
          },
          'post_id' | 'author_email' | 'author_name' | 'author_initials'
        > &
          Pick<{ content: string }, 'content'>;
        Update: { content?: string; updated_at?: number; deleted_at?: number | null };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          participant_ids: string[];
          status: string;
          requested_by: string | null;
          blocked_by: string | null;
          participant_meta: Json | null;
          created_at: number;
          last_message_at: number;
          preview: string | null;
          unread_map: Json | null;
          hidden_map: Json | null;
        };
        Insert: {
          participant_ids: string[];
          status?: string | null;
          requested_by?: string | null;
          blocked_by?: string | null;
          participant_meta?: Json | null;
          created_at?: number | null;
          last_message_at?: number | null;
          preview?: string | null;
          unread_map?: Json | null;
          hidden_map?: Json | null;
        };
        Update: {
          status?: string | null;
          requested_by?: string | null;
          blocked_by?: string | null;
          last_message_at?: number | null;
          participant_meta?: Json | null;
          preview?: string | null;
          unread_map?: Json | null;
          hidden_map?: Json | null;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string | null;
          sender_id: string | null;
          recipient_id: string | null;
          recipient_email: string | null;
          sender_email: string;
          sender_name: string;
          content: string;
          attachments: Json | null;
          mentions: Json | null;
          message_type: string;
          file_url: string | null;
          file_name: string | null;
          roll_number: string | null;
          created_at: number;
          is_read: boolean;
        };
        Insert: {
          conversation_id?: string | null;
          sender_id?: string | null;
          recipient_id?: string | null;
          recipient_email?: string | null;
          sender_email: string;
          sender_name: string;
          content: string;
          attachments?: Json | null;
          mentions?: Json | null;
          message_type?: string | null;
          file_url?: string | null;
          file_name?: string | null;
          roll_number?: string | null;
          created_at?: number | null;
          is_read?: boolean | null;
        };
        Update: {
          is_read?: boolean | null;
          attachments?: Json | null;
          mentions?: Json | null;
          message_type?: string | null;
          file_url?: string | null;
          file_name?: string | null;
          roll_number?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_email: string | null;
          recipient_role: string | null;
          type: string;
          message: string;
          read: boolean;
          created_at: number;
          post_id: string | null;
          conversation_id: string | null;
          actor_email: string | null;
          actor_name: string | null;
        };
        Insert: {
          recipient_email?: string | null;
          recipient_role?: string | null;
          type: string;
          message: string;
          created_at?: number | null;
          read?: boolean | null;
          post_id?: string | null;
          conversation_id?: string | null;
          actor_email?: string | null;
          actor_name?: string | null;
        };
        Update: { read?: boolean | null };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          location: string | null;
          event_date: number;
          category: string;
          max_attendees: number | null;
          created_by: string;
          created_by_name: string;
          created_at: number;
        };
        Insert: {
          title: string;
          description?: string | null;
          location?: string | null;
          event_date: number;
          category?: string;
          max_attendees?: number | null;
          created_by: string;
          created_by_name: string;
          created_at?: number;
        };
        Update: Partial<{ title: string; description: string | null; location: string | null; event_date: number; category: string; max_attendees: number | null }>;
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          user_email: string;
          user_name: string;
          created_at: number;
        };
        Insert: {
          event_id: string;
          user_email: string;
          user_name: string;
          created_at?: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      user_presence: {
        Row: {
          email: string;
          last_seen: number;
          updated_at: number;
        };
        Insert: {
          email: string;
          last_seen?: number | null;
          updated_at?: number | null;
        };
        Update: { last_seen?: number | null; updated_at?: number | null };
        Relationships: [];
      };
      exam_results: {
        Row: {
          id: string;
          user_id: string | null;
          recipient_email: string;
          roll_number: string;
          year: string;
          semester: string;
          file_name: string;
          file_url: string;
          storage_path: string;
          created_at: number;
          batch_id: string | null;
          student_name: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          recipient_email: string;
          roll_number: string;
          year: string;
          semester: string;
          file_name: string;
          file_url: string;
          storage_path: string;
          created_at?: number | null;
          batch_id?: string | null;
          student_name?: string | null;
        };
        Update: { batch_id?: string | null; student_name?: string | null };
        Relationships: [
          {
            foreignKeyName: 'exam_results_batch_id_fkey';
            columns: ['batch_id'];
            isOneToOne: false;
            referencedRelation: 'exam_result_batches';
            referencedColumns: ['id'];
          }
        ];
      };
      exam_result_batches: {
        Row: {
          id: string;
          exam_type: string;
          semester: string;
          academic_year: string;
          total_files: number;
          status: string;
          created_by: string | null;
          created_at: number;
        };
        Insert: {
          id?: string;
          exam_type: string;
          semester: string;
          academic_year: string;
          total_files?: number;
          status?: string;
          created_by?: string | null;
          created_at?: number | null;
        };
        Update: {
          id?: string;
          exam_type?: string;
          semester?: string;
          academic_year?: string;
          total_files?: number;
          status?: string;
          created_by?: string | null;
          created_at?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { conversation_status: 'pending' | 'active' | 'blocked' };
  };
}
