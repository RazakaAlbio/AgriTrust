import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, CreditCard, Server, Wifi, WifiOff,
  Loader2, CheckCircle2, LogOut, Link2, ExternalLink,
  ShieldCheck, AlertTriangle, Copy, RefreshCw, AlertCircle,
  UploadCloud, FileJson
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  ThirdwebProvider,
  ConnectButton,
  useActiveAccount,
} from "thirdweb/react";
import { polygonAmoy } from "thirdweb/chains";
import { thirdwebClient } from "@/lib/thirdweb";
import {
  anchorGradingRecord,
  verifyBatchOnChain,
  CONTRACT_ADDRESS,
  buildBlockchainTxUrl,
  type GradingPayload,
} from "@/lib/blockchain";
import DisputesTab from "@/components/dashboard/DisputesTab";



// ── Types ─────────────────────────────────────────────────────────────────────
interface UnsyncedScan {
  id: string;
  batchId: string;
  overallGrade: string;
  weightKg: number | null;
  gasPpm: number | null;
  createdAt: string;
  farmerName: string;
}

// ── Blockchain Tab (inner component — needs wallet context) ───────────────────
function BlockchainTabContent() {
  const account = useActiveAccount();
  const [scans, setScans] = useState<UnsyncedScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [anchoringId, setAnchoringId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { txHash: string; sha256Hex: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Recover flow: for scans already on-chain but missing tx_hash in DB
  const [recoverId, setRecoverId] = useState<string | null>(null);
  const [recoverTxInput, setRecoverTxInput] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  const fetchUnsynced = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("scans")
      .select(`
        id,
        batch_id,
        overall_grade,
        weight_kg,
        gas_ppm,
        created_at,
        tx_hash,
        farmers (name)
      `)
      .is("tx_hash", null)
      .order("created_at", { ascending: false });

    if (err) {
      setError("Failed to load scans from Supabase.");
    } else if (data) {
      setScans(
        data.map((row: any) => ({
          id: row.id,
          batchId: row.batch_id,
          overallGrade: row.overall_grade,
          weightKg: row.weight_kg,
          gasPpm: row.gas_ppm,
          createdAt: row.created_at,
          farmerName: row.farmers?.name ?? "Unknown",
        }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchUnsynced(); }, []);

  const handleAnchor = async (scan: UnsyncedScan) => {
    if (!account) return;
    setAnchoringId(scan.id);
    setError(null);

    const payload: GradingPayload = {
      batchId:      scan.batchId,
      overallGrade: scan.overallGrade,
      weightKg:     scan.weightKg,
      gasPpm:       scan.gasPpm,
      createdAt:    scan.createdAt,
    };

    try {
      const result = await anchorGradingRecord(account, scan.id, payload);
      setResults(prev => ({ ...prev, [scan.id]: result }));
      // Remove from unsynced list
      setScans(prev => prev.filter(s => s.id !== scan.id));
    } catch (err: any) {
      console.error(err);
      const msg: string = err?.message ?? "";

      // Detect the structured SUPABASE_UPDATE_FAILED error
      if (msg.startsWith("SUPABASE_UPDATE_FAILED|")) {
        const parts = msg.split("|");
        const txHash   = parts[1] ?? "";
        const sha256Hex = parts[2] ?? "";
        const detail   = parts.slice(3).join("|");
        // Blockchain anchor DID succeed — show the result but warn about DB
        setResults(prev => ({ ...prev, [scan.id]: { txHash, sha256Hex } }));
        setScans(prev => prev.filter(s => s.id !== scan.id));
        setError(
          `⚠️ Blockchain anchor succeeded but Supabase could not save the tx_hash. ` +
          `You must add an UPDATE policy on the scans table in Supabase. ` +
          `Run the SQL patch in supabase_setup.sql (see README or below). ` +
          `TX saved: ${txHash}`
        );
      } else if (msg.includes("already anchored")) {
        // Scan is confirmed on-chain but tx_hash missing in Supabase — enter recover mode
        setError(null);
        setRecoverId(scan.id);
        setRecoverTxInput("");
      } else {
        setError(`Failed to anchor ${scan.batchId}: ${msg || "Unknown error"}`);
      }
    } finally {
      setAnchoringId(null);
    }
  };

  // Save a manually-entered tx_hash to Supabase for an already-anchored scan
  const handleRecover = async (scan: UnsyncedScan) => {
    const txHash = recoverTxInput.trim();
    if (!txHash.startsWith("0x") || txHash.length < 10) {
      setError("Please enter a valid tx hash starting with 0x");
      return;
    }
    setIsRecovering(true);
    setError(null);
    try {
      // Verify it really is on-chain
      const onChain = await verifyBatchOnChain(scan.batchId);
      if (!onChain.exists) {
        setError(`Batch ${scan.batchId} is NOT found on-chain. Double-check the tx hash and batch ID.`);
        setIsRecovering(false);
        return;
      }
      // Save to Supabase
      const { error: dbErr } = await supabase
        .from("scans")
        .update({ tx_hash: txHash })
        .eq("id", scan.id);
      if (dbErr) {
        setError(`On-chain confirmed but Supabase update failed: ${dbErr.message}. Make sure the UPDATE RLS policy is applied (run supabase_rls_patch.sql).`);
      } else {
        setResults(prev => ({ ...prev, [scan.id]: { txHash, sha256Hex: onChain.sha256Hash } }));
        setScans(prev => prev.filter(s => s.id !== scan.id));
        setRecoverId(null);
        setRecoverTxInput("");
      }
    } catch (err: any) {
      setError(`Recovery failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setIsRecovering(false);
    }
  };


  const copyTx = (id: string, txHash: string) => {
    navigator.clipboard.writeText(txHash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const contractNotSet = !CONTRACT_ADDRESS;

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div>
        <h2 className="text-sm font-bold text-foreground">Blockchain Anchoring</h2>
        <p className="text-xs text-muted-foreground">
          Anchor unsynced grading scans to the Polygon Amoy testnet.
          Each scan's SHA-256 fingerprint is written immutably on-chain.
        </p>
      </div>

      {/* Contract status */}
      <div className={`p-3 border flex items-start gap-3 ${contractNotSet ? "border-orange-500/40 bg-orange-500/5" : "border-primary/30 bg-primary/5"}`}>
        <ShieldCheck className={`w-4 h-4 mt-0.5 shrink-0 ${contractNotSet ? "text-orange-400" : "text-primary"}`} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-foreground mb-0.5">
            Smart Contract · Polygon Amoy
          </p>
          {contractNotSet ? (
            <p className="text-[10px] text-orange-400">
              Contract address not set. Deploy the contract and add
              VITE_AGRITRUST_CONTRACT_ADDRESS to .env.local.
            </p>
          ) : (
            <a
              href={`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] text-primary hover:underline break-all"
            >
              {CONTRACT_ADDRESS}
            </a>
          )}
        </div>
      </div>

      {/* Wallet Connect */}
      <div className="border border-border p-4 space-y-3">
        <p className="data-label !mb-0">Wallet Connection</p>
        <ConnectButton
          client={thirdwebClient}
          chain={polygonAmoy}
          connectButton={{ label: "Connect Wallet (MetaMask / WalletConnect)" }}
          switchButton={{ label: "Switch to Polygon Amoy" }}
        />
        {account && (
          <p className="text-[10px] font-mono text-muted-foreground break-all">
            Connected: {account.address}
          </p>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-3 border border-destructive/50 bg-destructive/10 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recently anchored results */}
      <AnimatePresence>
        {Object.entries(results).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="border border-primary/30 bg-primary/5"
          >
            <div className="border-b border-primary/20 p-3">
              <p className="data-label !mb-0 text-primary">Recently Anchored</p>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(results).map(([id, r]) => (
                <div key={id} className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Anchored</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[10px] text-muted-foreground break-all flex-1">
                      TX: {r.txHash.slice(0, 20)}…{r.txHash.slice(-8)}
                    </code>
                    <button onClick={() => copyTx(id, r.txHash)} className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors">
                      {copiedId === id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a href={buildBlockchainTxUrl(r.txHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    SHA-256: {r.sha256Hex.slice(0, 24)}…
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsynced scans table */}
      <div className="border border-border">
        <div className="border-b border-border p-3 flex items-center justify-between bg-secondary/30">
          <p className="data-label !mb-0">Unsynced Scans (no tx_hash)</p>
          <button
            onClick={fetchUnsynced}
            disabled={isLoading}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm font-mono text-muted-foreground animate-pulse">
            Loading from Supabase…
          </div>
        ) : scans.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">All scans are anchored!</p>
            <p className="text-xs text-muted-foreground mt-1">No pending transactions.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {scans.map((scan, i) => (
              <motion.div
                key={scan.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm font-bold text-foreground">{scan.batchId}</p>
                      <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 border ${
                        scan.overallGrade === "Reject"
                          ? "border-destructive/50 text-destructive bg-destructive/10"
                          : scan.overallGrade === "Grade A"
                          ? "border-green-500/50 text-green-400 bg-green-500/10"
                          : "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                      }`}>
                        {scan.overallGrade}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {scan.farmerName} · {new Date(scan.createdAt).toLocaleDateString()}
                      {scan.weightKg != null && ` · ${scan.weightKg}kg`}
                      {scan.gasPpm != null && ` · ${scan.gasPpm}ppm`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending</span>
                    <button
                      onClick={() => handleAnchor(scan)}
                      disabled={!account || anchoringId === scan.id || contractNotSet || recoverId === scan.id}
                      className="btn-rugged flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {anchoringId === scan.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Anchoring…</>
                      ) : (
                        <><Link2 className="w-3.5 h-3.5" /> Anchor to Chain</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline recover panel — shown when this scan is "already anchored on-chain" */}
                <AnimatePresence>
                  {recoverId === scan.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="border border-yellow-500/40 bg-yellow-500/5 p-3 space-y-2 overflow-hidden"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                          <p className="font-bold text-yellow-300">Already anchored on-chain — tx_hash missing in database.</p>
                          <p className="text-yellow-300/70">
                            1. Open{" "}
                            <a
                              href={`https://amoy.polygonscan.com/address/${account?.address}`}
                              target="_blank" rel="noopener noreferrer"
                              className="underline hover:text-yellow-200"
                            >
                              your wallet on PolygonScan ↗
                            </a>
                            {" "}→ find the AgriTrust anchoring transaction → copy the TX Hash.
                          </p>
                          <p className="text-yellow-300/70">2. Paste it below and click <strong>Save TX</strong> to recover.</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={recoverTxInput}
                          onChange={e => setRecoverTxInput(e.target.value)}
                          placeholder="0x771bec286af27ae469e5a6a5d737a34a82da4f208..."
                          className="flex-1 bg-background border border-yellow-500/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-yellow-400"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleRecover(scan)}
                            disabled={isRecovering || !recoverTxInput.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-yellow-500/60 text-yellow-300 hover:bg-yellow-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isRecovering ? <><Loader2 className="w-3 h-3 animate-spin" /> Verifying…</> : <><CheckCircle2 className="w-3 h-3" /> Save TX</>}
                          </button>
                          <button
                            onClick={() => { setRecoverId(null); setRecoverTxInput(""); }}
                            className="px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!account && (
        <p className="text-xs text-center text-muted-foreground">
          ↑ Connect your wallet above to anchor scans to the blockchain.
        </p>
      )}
    </div>
  );
}

// ── Main AdminPanel component ─────────────────────────────────────────────────
export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"register" | "rfid" | "blockchain" | "disputes" | "sync">("register");

  // Register Form State
  const [form, setForm] = useState({ name: "", email: "", passcode: "", rfid_tag: "", location: "", group_class: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Data State
  const [farmers, setFarmers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tabs = [
    { id: "register"   as const, label: "Register",   icon: UserPlus  },
    { id: "rfid"       as const, label: "RFID Mgmt",  icon: CreditCard },
    { id: "blockchain" as const, label: "Blockchain", icon: Link2      },
    { id: "disputes"   as const, label: "Disputes",   icon: AlertCircle },
    { id: "sync"       as const, label: "Offline Sync", icon: UploadCloud },
  ];

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [farmRes] = await Promise.all([
        supabase.from('farmers').select('*')
      ]);
      if (farmRes.data) setFarmers(farmRes.data);
      setIsLoading(false);
    }
    fetchData();
  }, [activeTab]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg("");
    const { error } = await supabase.from('farmers').insert([form]);
    setIsSubmitting(false);
    if (!error) {
      setSuccessMsg("Farmer registered successfully!");
      setForm({ name: "", email: "", passcode: "", rfid_tag: "", location: "", group_class: "" });
      setTimeout(() => setSuccessMsg(""), 3000);
      const { data } = await supabase.from('farmers').select('*');
      if (data) setFarmers(data);
    } else {
      console.error(error);
      alert("Failed to register farmer.");
    }
  };

  const handleDeleteFarmer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this farmer? This action cannot be undone.")) return;
    // Hapus relasi scan terlebih dahulu agar tidak error foreign key constraint
    await supabase.from('scans').delete().eq('farmer_id', id);
    const { error } = await supabase.from('farmers').delete().eq('id', id);
    if (!error) {
      setFarmers(farmers.filter(f => f.id !== id));
    } else {
      alert("Failed to delete farmer: " + error.message);
    }
  };

  const handleRevokeRfid = async (id: string) => {
    if (!confirm("Revoke this RFID tag? The farmer will not be able to scan.")) return;
    const revokedTag = `REVOKED-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
    const { error } = await supabase.from('farmers').update({ rfid_tag: revokedTag }).eq('id', id);
    if (!error) {
      setFarmers(farmers.map(f => f.id === id ? { ...f, rfid_tag: revokedTag } : f));
    } else {
      alert("Failed to revoke RFID: " + error.message);
    }
  };

  const handleAssignRfid = async (id: string) => {
    const newTag = prompt("Enter new RFID tag (e.g. 1A2B3C4D):");
    if (!newTag) return;
    const cleanedTag = newTag.trim().toUpperCase();
    const { error } = await supabase.from('farmers').update({ rfid_tag: cleanedTag }).eq('id', id);
    if (!error) {
      setFarmers(farmers.map(f => f.id === id ? { ...f, rfid_tag: cleanedTag } : f));
    } else {
      alert("Failed to assign new RFID: " + error.message);
    }
  };

  return (
    <ThirdwebProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border p-4 flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
              ADMIN_PANEL
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              System Management · Protected Access
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/");
            }}
            className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-sm font-mono"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto p-4 space-y-0">
          {/* Tab Bar */}
          <div className="flex border border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 p-3 text-[10px] uppercase tracking-widest font-bold transition-colors border-r border-border last:border-r-0 ${
                  activeTab === tab.id
                    ? tab.id === "blockchain"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="border border-t-0 border-border bg-background p-6">
            <AnimatePresence mode="wait">
              {activeTab === "register" && (
                <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Register Farmer</h2>
                    <p className="text-xs text-muted-foreground">Add a new farmer and link their RFID tag.</p>
                  </div>

                  {successMsg && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">{successMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4 max-w-md">
                    <div>
                      <label className="data-label block mb-1.5">Full Name</label>
                      <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">Email (For Login)</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">Passcode (For Login)</label>
                      <input type="text" value={form.passcode} onChange={e => setForm({...form, passcode: e.target.value})} className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">RFID Tag (Hex)</label>
                      <input type="text" value={form.rfid_tag} onChange={e => setForm({...form, rfid_tag: e.target.value})} required placeholder="e.g. 0x4A:2F:8C:D1" className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground uppercase" />
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">Location</label>
                      <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required placeholder="e.g. Bandung, West Java" className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">Group / Class</label>
                      <input type="text" value={form.group_class} onChange={e => setForm({...form, group_class: e.target.value})} className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="btn-rugged w-full mt-4 flex items-center justify-center gap-2">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Profile"}
                    </button>
                  </form>
                </motion.div>
              )}

              {activeTab === "rfid" && (
                <motion.div key="rfid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">RFID Database</h2>
                    <p className="text-xs text-muted-foreground">Manage linked hardware tokens.</p>
                  </div>
                  {isLoading ? (
                    <div className="text-sm text-muted-foreground animate-pulse">Loading farmers...</div>
                  ) : (
                    <div className="border border-border">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-secondary/30 border-b border-border">
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">RFID HEX</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Linked User</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {farmers.map((farmer, i) => (
                            <tr key={i} className="hover:bg-secondary/10">
                              <td className="p-3 font-mono text-sm text-primary">
                                {(!farmer.rfid_tag || farmer.rfid_tag.startsWith('REVOKED-')) ? "UNASSIGNED" : farmer.rfid_tag}
                              </td>
                              <td className="p-3 text-sm text-foreground">{farmer.name}</td>
                              <td className="p-3">
                                {(!farmer.rfid_tag || farmer.rfid_tag.startsWith('REVOKED-')) ? (
                                  <span className="text-[10px] uppercase tracking-widest font-bold text-orange-500 border border-orange-500/30 bg-orange-500/10 px-2 py-0.5">No Tag</span>
                                ) : (
                                  <span className="text-[10px] uppercase tracking-widest font-bold text-green-500 border border-green-500/30 bg-green-500/10 px-2 py-0.5">Linked</span>
                                )}
                              </td>
                              <td className="p-3 text-right space-x-2">
                                {(!farmer.rfid_tag || farmer.rfid_tag.startsWith('REVOKED-')) ? (
                                  <button onClick={() => handleAssignRfid(farmer.id)} className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-green-500 border border-border hover:border-green-500/50 px-2 py-1 transition-colors">
                                    Assign
                                  </button>
                                ) : (
                                  <button onClick={() => handleRevokeRfid(farmer.id)} className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-orange-500 border border-border hover:border-orange-500/50 px-2 py-1 transition-colors">
                                    Revoke
                                  </button>
                                )}
                                <button onClick={() => handleDeleteFarmer(farmer.id)} className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-destructive border border-border hover:border-destructive/50 px-2 py-1 transition-colors">
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              )}



              {activeTab === "blockchain" && (
                <motion.div key="blockchain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <BlockchainTabContent />
                </motion.div>
              )}

              {activeTab === "disputes" && (
                <motion.div key="disputes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6">
                    <h2 className="text-sm font-bold text-foreground">Dispute Resolution</h2>
                    <p className="text-xs text-muted-foreground">Review, investigate, and resolve customer reports.</p>
                  </div>
                  <DisputesTab />
                </motion.div>
              )}

              {activeTab === "sync" && (
                <motion.div key="sync" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Offline JSON Sync</h2>
                    <p className="text-xs text-muted-foreground">Upload the `offline_queue.json` file from a Jetson Nano that lost network connection.</p>
                  </div>
                  
                  <div className="border border-dashed border-border p-8 text-center bg-secondary/10">
                    <input 
                      type="file" 
                      accept=".json" 
                      id="json-upload" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          try {
                            const text = event.target?.result as string;
                            const data = JSON.parse(text);
                            if (!Array.isArray(data)) throw new Error("JSON must be an array of scans.");
                            
                            // Insert into Supabase
                            const { error } = await supabase.from('scans').insert(data);
                            if (error) throw error;
                            
                            alert(`Successfully imported ${data.length} offline scans!`);
                          } catch (err: any) {
                            alert(`Failed to import JSON: ${err.message}`);
                          }
                        };
                        reader.readAsText(file);
                        
                        // Reset input so the same file can be selected again if needed
                        e.target.value = "";
                      }} 
                    />
                    <label htmlFor="json-upload" className="cursor-pointer flex flex-col items-center justify-center gap-3 hover:opacity-80 transition-opacity">
                      <FileJson className="w-10 h-10 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-bold text-foreground">Select offline_queue.json</p>
                        <p className="text-xs text-muted-foreground mt-1">Click to browse your files</p>
                      </div>
                      <div className="btn-rugged px-4 py-2 mt-2 text-xs inline-flex items-center gap-2">
                        <UploadCloud className="w-3.5 h-3.5" />
                        Browse File
                      </div>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ThirdwebProvider>
  );
}
