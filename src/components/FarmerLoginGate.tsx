import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Sprout, Loader2, AlertTriangle, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function FarmerLoginGate({ onLogin }: { onLogin: (farmer: any) => void }) {
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !passcode) {
      setError("Please enter both email and passcode");
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      const { data, error: dbError } = await supabase
        .from('farmers')
        .select('*')
        .eq('email', email)
        .eq('passcode', passcode)
        .single();

      if (dbError || !data) {
        setError("Invalid email or passcode");
      } else {
        onLogin(data);
      }
    } catch (err) {
      setError("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 border border-primary/30 flex items-center justify-center rounded-full mb-4">
            <Sprout className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-mono text-2xl font-bold tracking-tighter text-foreground">
            FARMER_<span className="text-primary">PORTAL</span>
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Secure Authentication
          </p>
        </div>

        <form onSubmit={handleLogin} className="border border-border bg-secondary/5 p-6 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-xs font-bold text-destructive uppercase tracking-widest">{error}</span>
            </div>
          )}

          <div>
            <label className="data-label block mb-2">Farmer Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-primary transition-colors text-foreground"
              placeholder="e.g. farmer@agritrust.com"
            />
          </div>

          <div>
            <label className="data-label block mb-2">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-background border border-border px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-primary transition-colors text-foreground"
              placeholder="Enter your assigned passcode"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-rugged w-full py-3 mt-4 flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authenticate"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
