import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, AlertTriangle } from "lucide-react";

const MOCK_CREDENTIALS = { username: "admin", password: "agritrust2024" };

interface AdminLoginGateProps {
  children: React.ReactNode;
}

export default function AdminLoginGate({ children }: AdminLoginGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === MOCK_CREDENTIALS.username && password === MOCK_CREDENTIALS.password) {
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

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
            <label className="data-label block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
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

          <button type="submit" className="btn-rugged w-full">
            Authenticate
          </button>

          <p className="text-[9px] uppercase tracking-widest text-muted-foreground text-center">
            Demo: admin / agritrust2024
          </p>
        </form>
      </motion.div>
    </div>
  );
}
