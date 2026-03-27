"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUidRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadProfileForUser(nextUser: User | null) {
      if (!nextUser) {
        currentUidRef.current = null;
        setUser(null);
        setProfile(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", nextUser.id)
          .single();

        if (cancelled) return;

        if (error) {
          console.error("Failed to load profile", error);
          currentUidRef.current = null;
          setUser(null);
          setProfile(null);
          return;
        }

        if (data) {
          currentUidRef.current = nextUser.id;
          setUser(nextUser);
          setProfile(data);
          return;
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Unexpected profile load error", error);
        currentUidRef.current = null;
        setUser(null);
        setProfile(null);
        return;
      }

      await supabase.auth.signOut();
      currentUidRef.current = null;
      setUser(null);
      setProfile(null);
    }

    async function getUser() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) await loadProfileForUser(user ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch auth user", error);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUid = session?.user?.id ?? null;

      if (nextUid === currentUidRef.current) return;

      setLoading(true);
      try {
        await loadProfileForUser(session?.user ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error("Auth state change handler failed", error);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
