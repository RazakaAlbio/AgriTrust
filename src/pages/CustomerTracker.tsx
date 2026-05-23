import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, AlertTriangle, CheckCircle2,
  Clock, Eye, XCircle, MessageSquare, Loader2, Link2, Info
} from "lucide-react";
import {
  fetchDisputeById,
  fetchDisputeResponses,
  submitDisputeResponse,
  DISPUTE_TYPE_LABELS,
  type Dispute,
  type DisputeStatus,
  type DisputeResponse,
} from "@/lib/disputeService";
import { shortId } from "@/lib/emailService";

// ─── Status Config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DisputeStatus, {
  label: string; icon: typeof Clock; colorClass: string; bgClass: string; desc: string;
}> = {
  pending:      { label: "Pending Review", icon: Clock,        colorClass: "text-yellow-400", bgClass: "bg-yellow-500/10 border-yellow-500/30", desc: "Report received and waiting for admin review." },
  under_review: { label: "Under Review",   icon: Eye,          colorClass: "text-blue-400",   bgClass: "bg-blue-500/10 border-blue-500/30",   desc: "Admin team is reviewing the claim and evidence." },
  resolved:     { label: "Resolved",       icon: CheckCircle2, colorClass: "text-green-400",  bgClass: "bg-green-500/10 border-green-500/30", desc: "Dispute has been settled." },
  rejected:     { label: "Rejected",       icon: XCircle,      colorClass: "text-red-400",    bgClass: "bg-red-500/10 border-red-500/30",     desc: "Claim was rejected after review." },
};

export default function CustomerTracker() {
  const [query, setQuery] = useState("");
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [responses, setResponses] = useState<DisputeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSearch = async (searchId: string) => {
    if (!searchId.trim()) return;
    setError("");
    setIsLoading(true);
    setDispute(null);

    try {
      const result = await fetchDisputeById(searchId.trim());
      if (result) {
        setDispute(result);
        const resps = await fetchDisputeResponses(result.id);
        setResponses(resps);
      } else {
        setError("Dispute not found. Please check your ID.");
      }
    } catch (err) {
      setError("Error looking up dispute. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for live chat updates
  useEffect(() => {
    if (!dispute) return;
    const interval = setInterval(async () => {
      try {
        const result = await fetchDisputeById(dispute.id);
        if (result) setDispute(result);
        const updatedResponses = await fetchDisputeResponses(dispute.id);
        setResponses(updatedResponses);
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [dispute]);

  const handleReply = async () => {
    if (!replyText.trim() || !dispute) return;
    setSending(true);
    try {
      await submitDisputeResponse({
        dispute_id:  dispute.id,
        author_type: "customer",
        author_name: dispute.customer_name,
        message:     replyText.trim(),
      });
      setReplyText("");
      const updated = await fetchDisputeResponses(dispute.id);
      setResponses(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Search Input */}
        <div className="border border-border bg-background p-4 flex flex-col gap-3">
          <p className="data-label !mb-0">Look up your dispute ID</p>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full bg-background border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={isLoading || !query.trim()}
              className="btn-rugged px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Track
            </button>
          </div>
          {error && <p className="text-[10px] text-destructive uppercase tracking-widest">{error}</p>}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {!isLoading && !dispute && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-border p-8 text-center bg-secondary/5"
            >
              <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Enter your Dispute ID to track progress.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-2">
                This ID was given to you when you filed your report on the Verify tab.
              </p>
            </motion.div>
          )}

          {dispute && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-border bg-background divide-y divide-border"
            >
              {/* Header block */}
              <div className="p-6 text-center bg-secondary/5">
                <p className="data-label mb-1">Dispute Status</p>
                {(() => {
                  const cfg = STATUS_CONFIG[dispute.status];
                  return (
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-16 h-16 rounded-full border flex items-center justify-center mb-2 ${cfg.bgClass}`}>
                        <cfg.icon className={`w-8 h-8 ${cfg.colorClass}`} />
                      </div>
                      <p className={`font-mono text-xl font-bold uppercase tracking-widest ${cfg.colorClass}`}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-sm">{cfg.desc}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Resolution details (if any) */}
              {(dispute.status === "resolved" || dispute.status === "rejected") && dispute.resolution_note && (
                <div className={`p-5 ${STATUS_CONFIG[dispute.status].bgClass}`}>
                  <p className="data-label mb-2">Admin Resolution Note</p>
                  <p className="text-sm text-foreground leading-relaxed font-medium">"{dispute.resolution_note}"</p>
                  {dispute.refund_approved && (
                    <span className="inline-flex items-center gap-1.5 mt-3 text-[10px] uppercase tracking-widest text-green-400 border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Refund Approved
                    </span>
                  )}
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="p-4 space-y-4">
                  <div>
                    <p className="data-label">Reference ID</p>
                    <p className="text-sm font-mono font-bold text-foreground">{shortId(dispute.id)}</p>
                  </div>
                  <div>
                    <p className="data-label">Date Filed</p>
                    <p className="text-sm font-medium text-foreground">{new Date(dispute.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="data-label">Reported By</p>
                    <p className="text-sm font-medium text-foreground">{dispute.customer_name}</p>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="data-label">Target Batch</p>
                    <p className="text-sm font-mono font-bold text-foreground">{dispute.batch_id}</p>
                  </div>
                  <div>
                    <p className="data-label">Dispute Type</p>
                    <p className="text-sm font-medium text-foreground">{DISPUTE_TYPE_LABELS[dispute.dispute_type]}</p>
                  </div>
                  <div>
                    <p className="data-label">Farmer Notified</p>
                    <p className="text-sm font-medium text-foreground">{dispute.farmer_name || "Unknown"}</p>
                  </div>
                </div>
              </div>

              {/* Description & Thread */}
              <div className="p-5">
                <p className="data-label mb-2">Your Original Claim</p>
                <div className="border border-border bg-secondary/10 p-3 mb-4">
                  <p className="text-sm text-foreground leading-relaxed italic">"{dispute.description}"</p>
                </div>

                <div className="flex items-center gap-2 mb-3 mt-6">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <p className="data-label !mb-0">Communication Thread</p>
                </div>

                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {responses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No additional responses from admin or farmer yet.</p>
                  ) : (
                    responses.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 border text-sm ${
                          r.author_type === "admin"
                            ? "border-primary/30 bg-primary/5"
                            : r.author_type === "customer"
                            ? "border-border bg-secondary/10 ml-6"
                            : "border-green-500/30 bg-green-500/5"
                        }`}
                      >
                        <div className="flex justify-between mb-2">
                          <span className={`font-bold uppercase tracking-widest text-[10px] ${
                            r.author_type === "admin" ? "text-primary" : r.author_type === "customer" ? "text-foreground" : "text-green-400"
                          }`}>
                            {r.author_type === "admin" ? "AgriTrust Admin" : r.author_type === "customer" ? "You" : `Farmer: ${r.author_name}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-foreground leading-relaxed">{r.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Customer Reply Box */}
                {dispute.status !== "resolved" && dispute.status !== "rejected" && (
                  <div className="flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Send a message to admin/farmer..."
                      rows={2}
                      className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                    <button
                      onClick={handleReply}
                      disabled={sending || !replyText.trim()}
                      className="btn-rugged px-4 flex items-center justify-center gap-2 disabled:opacity-40 self-start mt-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
