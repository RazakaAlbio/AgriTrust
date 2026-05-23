import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Search, Sprout, AlertTriangle, CheckCircle2,
  Clock, Eye, XCircle, ExternalLink, MessageSquare,
  Send, ChevronDown, ChevronUp, Loader2, Info,
} from "lucide-react";
import {
  fetchDisputesByBatch,
  fetchDisputesByFarmer,
  submitDisputeResponse,
  DISPUTE_TYPE_LABELS,
  type Dispute,
  type DisputeStatus,
  type DisputeResponse,
} from "@/lib/disputeService";
import { shortId } from "@/lib/emailService";

// ─── Status styling ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DisputeStatus, {
  label: string; icon: typeof Clock; colorClass: string; bgClass: string;
}> = {
  pending:      { label: "Pending Review", icon: Clock,        colorClass: "text-yellow-400", bgClass: "bg-yellow-500/10 border-yellow-500/30" },
  under_review: { label: "Under Review",   icon: Eye,          colorClass: "text-blue-400",   bgClass: "bg-blue-500/10 border-blue-500/30" },
  resolved:     { label: "Resolved",       icon: CheckCircle2, colorClass: "text-green-400",  bgClass: "bg-green-500/10 border-green-500/30" },
  rejected:     { label: "Rejected",       icon: XCircle,      colorClass: "text-red-400",    bgClass: "bg-red-500/10 border-red-500/30" },
};

// ─── Dispute Card ─────────────────────────────────────────────────────────

function DisputeCard({
  dispute,
  farmerName,
}: {
  dispute: Dispute;
  farmerName: string;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending]     = useState(false);
  const [localResponses, setLocalResponses] = useState<DisputeResponse[]>(
    (dispute.responses ?? []) as DisputeResponse[]
  );
  const [sent, setSent] = useState(false);

  const cfg = STATUS_CONFIG[dispute.status];

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await submitDisputeResponse({
        dispute_id:  dispute.id,
        author_type: "farmer",
        author_name: farmerName,
        message:     replyText.trim(),
      });
      setLocalResponses(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          dispute_id:  dispute.id,
          author_type: "farmer",
          author_name: farmerName,
          message:     replyText.trim(),
        },
      ]);
      setReplyText("");
      setSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border bg-background"
    >
      {/* Card Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors"
      >
        <cfg.icon className={`w-4 h-4 shrink-0 ${cfg.colorClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-foreground">
              Dispute {shortId(dispute.id)}
            </span>
            <span className={`text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${cfg.bgClass} ${cfg.colorClass}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {DISPUTE_TYPE_LABELS[dispute.dispute_type]} · {new Date(dispute.created_at).toLocaleDateString()}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border divide-y divide-border">
              {/* Description */}
              <div className="p-4">
                <p className="data-label mb-2">Customer's Description</p>
                <p className="text-sm text-foreground leading-relaxed">{dispute.description}</p>
              </div>

              {/* Video link */}
              {dispute.video_link && (
                <div className="p-4 flex items-center gap-3">
                  <p className="data-label !mb-0">Unboxing Video</p>
                  <a
                    href={dispute.video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline font-mono break-all"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    Watch Video
                  </a>
                </div>
              )}

              {/* Resolution (if settled) */}
              {(dispute.status === "resolved" || dispute.status === "rejected") && dispute.resolution_note && (
                <div className={`p-4 ${cfg.bgClass}`}>
                  <p className="data-label mb-1">Admin Resolution</p>
                  <p className="text-sm text-foreground">{dispute.resolution_note}</p>
                  {dispute.refund_approved && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-widest text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-1">
                      <CheckCircle2 className="w-3 h-3" /> Refund Approved
                    </span>
                  )}
                </div>
              )}

              {/* Response thread */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="data-label !mb-0">Conversation Thread</p>
                </div>

                {localResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No responses yet. Be the first to respond.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {localResponses.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 border text-xs ${
                          r.author_type === "admin"
                            ? "border-primary/30 bg-primary/5"
                            : "border-green-500/20 bg-green-500/5 ml-4"
                        }`}
                      >
                        <div className="flex justify-between mb-1">
                          <span className={`font-bold uppercase tracking-widest text-[10px] ${
                            r.author_type === "admin" ? "text-primary" : "text-green-400"
                          }`}>
                            {r.author_type === "admin" ? "AgriTrust Admin" : `You (${r.author_name})`}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-foreground leading-relaxed">{r.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Farmer reply form */}
                {dispute.status !== "resolved" && dispute.status !== "rejected" && (
                  <div className="space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Explain your side — e.g. 'This batch was packed correctly on the scan date. Customer may have received a different seller's product.'"
                      rows={3}
                      className="w-full bg-secondary/10 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                    {sent && (
                      <p className="text-[10px] text-green-400 uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Response sent!
                      </p>
                    )}
                    <button
                      onClick={handleReply}
                      disabled={sending || !replyText.trim()}
                      className="btn-rugged flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
                    >
                      {sending
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                        : <><Send className="w-3.5 h-3.5" /> Submit Response</>
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function FarmerDisputePortal() {
  const [searchMode, setSearchMode] = useState<"batch" | "name">("batch");
  const [query, setQuery]           = useState("");
  const [farmerNameInput, setFarmerNameInput] = useState("");
  const [disputes, setDisputes]     = useState<Dispute[] | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [searchedFor, setSearchedFor] = useState("");
  const [error, setError]           = useState("");

  const handleSearch = async () => {
    const q = query.trim().toUpperCase();
    const n = farmerNameInput.trim();
    if (searchMode === "batch" && !q)  { setError("Please enter a Batch ID"); return; }
    if (searchMode === "name"  && !n)  { setError("Please enter your name");   return; }

    setError("");
    setIsLoading(true);
    setDisputes(null);

    try {
      let results: Dispute[];
      if (searchMode === "batch") {
        results = await fetchDisputesByBatch(q);
        setSearchedFor(q);
      } else {
        results = await fetchDisputesByFarmer(n);
        setSearchedFor(n);
      }
      setDisputes(results);
    } catch (err) {
      setError("Failed to fetch disputes. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeFarmerName = searchMode === "name" ? farmerNameInput.trim() : (disputes?.[0]?.farmer_name ?? "Farmer");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center gap-4">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-primary" />
            <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
              FARMER_<span className="text-primary">PORTAL</span>
            </h1>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Batch Dispute Lookup · Respond to Customer Reports
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Info notice */}
        <div className="border border-border bg-secondary/5 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            This portal lets you check if any disputes have been filed against your batches and respond directly.
            Your response will be reviewed by the AgriTrust admin team and may be shared with the disputing party.
          </p>
        </div>

        {/* Search card */}
        <div className="border border-border bg-background">
          <div className="border-b border-border p-4 bg-secondary/10">
            <p className="data-label mb-3">Search Your Disputes</p>

            {/* Mode toggle */}
            <div className="flex border border-border mb-3">
              {(["batch", "name"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setSearchMode(mode); setDisputes(null); setError(""); }}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${
                    searchMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {mode === "batch" ? "By Batch ID" : "By Farmer Name"}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {searchMode === "batch" ? (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. BATCH_2024_0847"
                    className="w-full bg-background border border-border pl-9 pr-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={farmerNameInput}
                    onChange={(e) => setFarmerNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. Ahmad Rizal"
                    className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="btn-rugged px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {error && (
              <p className="text-[10px] text-destructive mt-2 uppercase tracking-widest">{error}</p>
            )}
          </div>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-12"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Fetching disputes...
              </p>
            </motion.div>
          )}

          {!isLoading && disputes !== null && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="data-label">
                  {disputes.length} dispute{disputes.length !== 1 ? "s" : ""} found for "{searchedFor}"
                </p>
                {disputes.some(d => d.status === "pending" || d.status === "under_review") && (
                  <span className="flex items-center gap-1.5 text-[10px] text-orange-400 uppercase tracking-widest">
                    <AlertTriangle className="w-3 h-3" /> Action Required
                  </span>
                )}
              </div>

              {disputes.length === 0 ? (
                <div className="border border-border p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No Disputes Found</p>
                  <p className="text-xs text-muted-foreground">
                    No disputes have been filed against this batch or farmer.
                  </p>
                </div>
              ) : (
                disputes.map((dispute) => (
                  <DisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    farmerName={activeFarmerName}
                  />
                ))
              )}
            </motion.div>
          )}

          {!isLoading && disputes === null && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-16 text-center"
            >
              <Sprout className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-medium text-foreground">Check Your Batch Disputes</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Enter your Batch ID or name above to see if any disputes have been filed and respond to them.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
