"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfileForUser(nextUser: User | null) {
      if (!nextUser) {
        setUser(null);
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .single();

      if (data) {
        setUser(nextUser);
        setProfile(data);
        return;
      }

      // User exists in auth but profile is gone (deleted from DB) — sign out.
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    }

    async function getUser() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await loadProfileForUser(user ?? null);
      setLoading(false);
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      await loadProfileForUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, loading };
}
