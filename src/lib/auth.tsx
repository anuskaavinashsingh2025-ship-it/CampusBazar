import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ensureProfile } from "@/lib/supabase-account";
import { saveLogin } from "@/lib/saved-login";

export type Profile = Tables<"profiles">;
export type AppRole = "user" | "admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isProfileComplete: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);

  const loadUserData = useCallback(async (authUser: User) => {
    await ensureProfile(authUser);
    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", authUser.id),
    ]);
    setProfile(profileData ?? null);
    setRoles((roleData ?? []).map((r) => r.role as AppRole));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserData(user);
    }
  }, [loadUserData, user]);

  useEffect(() => {
    // Register listener first, then read the existing session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      currentUserId.current = nextSession?.user?.id ?? null;

      if (nextSession?.user && event === "SIGNED_IN" && nextSession.user.email) {
        saveLogin({
          email: nextSession.user.email,
          displayName: (nextSession.user.user_metadata?.full_name as string | undefined) ?? undefined,
          provider:
            nextSession.user.app_metadata?.provider === "google" ? "google" : "email",
        });
      }

      if (nextSession?.user) {
        // Defer Supabase calls to avoid deadlocking inside the callback.
        setTimeout(() => {
          void loadUserData(nextSession.user);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      currentUserId.current = existing?.user?.id ?? null;
      if (existing?.user) {
        void loadUserData(existing.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      roles,
      isAdmin: roles.includes("admin"),
      isProfileComplete: profile?.is_profile_complete ?? false,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, user, profile, roles, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
