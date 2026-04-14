"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  /** Only true until the first `getUser()` + profile load finishes — never during later auth events. */
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const profileIdRef = useRef<string | null>(null);
  useEffect(() => {
    profileIdRef.current = profile?.id ?? null;
  }, [profile?.id]);

  const resolveUser = useCallback(async (supabase: ReturnType<typeof createClient>, nextUser: User | null) => {
    if (!nextUser) {
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error("Failed to load profile", error);
        setUser(nextUser);
        setProfile(null);
        return;
      }

      setUser(nextUser);
      setProfile(data ?? null);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Unexpected profile load error", err);
      setUser(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    async function initialLoad() {
      setLoading(true);
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (mountedRef.current) {
          await resolveUser(supabase, authUser ?? null);
        }
      } catch (err) {
        if (mountedRef.current) {
          console.error("Failed to fetch auth user", err);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
      if (event === "INITIAL_SESSION") return;

      // Tab focus runs _recoverAndRefresh() → often SIGNED_IN (not just TOKEN_REFRESHED).
      // Same user: skip profile refetch; still handle sign-out and profile-affecting events.
      const uid = session?.user?.id;
      if (
        uid &&
        uid === profileIdRef.current &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
      ) {
        return;
      }

      try {
        await resolveUser(supabase, session?.user ?? null);
      } catch (err) {
        if (mountedRef.current) {
          console.error("Auth state change handler failed", err);
          setUser(null);
          setProfile(null);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [resolveUser]);

  return { user, profile, loading };
}
