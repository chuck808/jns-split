import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Mailer } from '#lib/server/mail';
declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient | null;
      user: User | null;
      backendReady: boolean;
      /** Null when invitation emails aren't set up. */
      mailer: Mailer | null;
    }
  }
}
export {};
