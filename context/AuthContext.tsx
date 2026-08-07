'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        setSession(data.session);
        // data.session.user comes straight from storage (cookies) and isn't
        // verified — getUser() re-checks it against the Auth server before
        // we trust it for anything security-sensitive (e.g. RouteGuard).
        setUser(await getVerifiedUser(data.session));
      } catch (error) {
        console.error('Error loading session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    const getVerifiedUser = async (currentSession: Session | null) => {
      if (!currentSession) return null;
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error verifying user:', error);
        return null;
      }
      return data.user;
    };

    getSession();

    // Set up auth listener. Deliberately does NOT call getVerifiedUser()
    // (another getUser() network round-trip) here — onAuthStateChange
    // fires for background events too, most commonly TOKEN_REFRESHED,
    // which the SDK emits periodically throughout a session after it has
    // already refreshed the token via its own network call. Re-verifying
    // via a second getUser() call on every one of those was a real,
    // recurring source of concurrent auth calls racing Supabase's
    // refresh-token rotation — not just a page-load-time issue, an
    // ongoing one, which could corrupt the session badly enough that only
    // clearing cookies recovered it. currentSession here already reflects
    // a network-verified result of that event; trust it directly.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);

      if (data.session) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) throw userError;
        setUser(userData.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
