"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const inflightRef = useRef(0);

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
        .single();

      if (!mountedRef.current) return;

      if (error || !data) {
        console.error("Failed to load profile", error);
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(nextUser);
      setProfile(data);
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
      inflightRef.current++;
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
        inflightRef.current--;
        if (mountedRef.current && inflightRef.current === 0) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") return;

      inflightRef.current++;
      setLoading(true);
      try {
        await resolveUser(supabase, session?.user ?? null);
      } catch (err) {
        if (mountedRef.current) {
          console.error("Auth state change handler failed", err);
          setUser(null);
          setProfile(null);
        }
      } finally {
        inflightRef.current--;
        if (mountedRef.current && inflightRef.current === 0) {
          setLoading(false);
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
