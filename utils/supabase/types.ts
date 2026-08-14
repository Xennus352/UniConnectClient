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
          Partial<{ image: string; tags: Json; status: string; shares_count?: number } & Pick<{ content: string }, 'content'>>;
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
        };
      };
      post_likes: {
        Row: { id: string; post_id: string; user_email: string; created_at: number };
        Insert: { post_id: string; user_email: string };
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
        };
        Update: {
          status?: string | null;
          requested_by?: string | null;
          blocked_by?: string | null;
          last_message_at?: number | null;
          participant_meta?: Json | null;
          preview?: string | null;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_email: string;
          sender_name: string;
          content: string;
          created_at: number;
          is_read: boolean;
        };
        Insert: {
          conversation_id: string;
          sender_email: string;
          sender_name: string;
          content: string;
          created_at?: number | null;
          is_read?: boolean | null;
        };
        Update: { is_read?: boolean | null };
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
        };
        Insert: {
          recipient_email?: string | null;
          recipient_role?: string | null;
          type: string;
          message: string;
          created_at?: number | null;
          read?: boolean | null;
        };
        Update: { read?: boolean | null };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { conversation_status: 'pending' | 'active' | 'blocked' };
  };
}
