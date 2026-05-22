import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface AdminLoginGateProps {
  children: React.ReactNode;
}

export default function AdminLoginGate({ children }: AdminLoginGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthenticated(true);
      setIsLoading(false);
    });

    // Listen for auth changes (like logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    try {
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      });

      if (sbError || !data.session) {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 1, 0.3, 1] as const }}
        className="w-full max-w-sm border border-border"
      >
        <div className="border-b border-border p-6 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 mr-1" title="Back to Home">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Lock className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
              ADMIN_ACCESS
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Protected · Authentication Required
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 border border-destructive p-3">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-[10px] uppercase tracking-widest text-destructive font-bold">
                Invalid Credentials
              </p>
            </div>
          )}

          <div>
            <label className="data-label block mb-1.5">Email / Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin email"
              className="w-full bg-background border border-border p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="data-label block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-background border border-border p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-rugged w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authenticate"}
          </button>

          <p className="text-[9px] uppercase tracking-widest text-muted-foreground text-center">
            Secured via Supabase
          </p>
        </form>
      </motion.div>
    </div>
  );
}
