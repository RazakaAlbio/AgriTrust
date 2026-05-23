import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ChevronDown, ChevronUp, ExternalLink,
  CheckCircle2, XCircle, Clock, Eye, RefreshCw,
  MessageSquare, Send, Filter, Loader2,
} from "lucide-react";
import {
  fetchDisputes,
  updateDisputeStatus,
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
  label: string; icon: typeof Clock; colorClass: string; bgClass: string;
}> = {
  pending:      { label: "Pending",      icon: Clock,         colorClass: "text-yellow-400",  bgClass: "bg-yellow-500/10 border-yellow-500/30" },
  under_review: { label: "Under Review", icon: Eye,           colorClass: "text-blue-400",    bgClass: "bg-blue-500/10 border-blue-500/30" },
  resolved:     { label: "Resolved",     icon: CheckCircle2,  colorClass: "text-green-400",   bgClass: "bg-green-500/10 border-green-500/30" },
  rejected:     { label: "Rejected",     icon: XCircle,       colorClass: "text-red-400",     bgClass: "bg-red-500/10 border-red-500/30" },
};

// ─── Detail Drawer ─────────────────────────────────────────────────────────

function DisputeDetail({ dispute, onUpdated }: { dispute: Dispute; onUpdated: () => void }) {
  const [responses, setResponses]         = useState<DisputeResponse[]>([]);
  const [loadingResp, setLoadingResp]     = useState(false);
  const [replyText, setReplyText]         = useState("");
  const [sending, setSending]             = useState(false);
  const [resolutionNote, setResolutionNote] = useState(dispute.resolution_note ?? "");
  const [refundApproved, setRefundApproved] = useState(dispute.refund_approved ?? false);
  const [updating, setUpdating]           = useState(false);

  useEffect(() => {
    setLoadingResp(true);
    fetchDisputeResponses(dispute.id)
      .then(setResponses)
      .catch(console.error)
      .finally(() => setLoadingResp(false));

    // Poll for live chat updates
    const interval = setInterval(async () => {
      try {
        const updated = await fetchDisputeResponses(dispute.id);
        setResponses(updated);
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [dispute.id]);

  const handleStatusChange = async (status: DisputeStatus) => {
    setUpdating(true);
    try {
      await updateDisputeStatus(dispute.id, status, {
        resolution_note: resolutionNote,
        refund_approved:  refundApproved,
        customer_email:   dispute.customer_email,
        customer_name:    dispute.customer_name,
        batch_id:         dispute.batch_id,
      });
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await submitDisputeResponse({
        dispute_id:  dispute.id,
        author_type: "admin",
        author_name: "AgriTrust Admin",
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

  const isSettled = dispute.status === "resolved" || dispute.status === "rejected";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="border-t border-border bg-secondary/5 divide-y divide-border">
        {/* Customer & Batch Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-4 space-y-2">
            <p className="data-label">Customer</p>
            <p className="text-sm font-medium text-foreground">{dispute.customer_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{dispute.customer_email}</p>
          </div>
          <div className="p-4 space-y-2">
            <p className="data-label">Batch / Grade</p>
            <p className="text-sm font-mono font-bold text-foreground">{dispute.batch_id}</p>
            <p className="text-xs text-muted-foreground">Certified: {dispute.claimed_grade ?? "Unknown"}</p>
          </div>
          <div className="p-4 space-y-2">
            <p className="data-label">Farmer</p>
            <p className="text-sm font-medium text-foreground">{dispute.farmer_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{DISPUTE_TYPE_LABELS[dispute.dispute_type]}</p>
          </div>
        </div>

        {/* Description */}
        <div className="p-4">
          <p className="data-label mb-2">Description</p>
          <p className="text-sm text-foreground leading-relaxed">{dispute.description}</p>
        </div>

        {/* Video Evidence */}
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
              {dispute.video_link}
            </a>
          </div>
        )}

        {/* Responses Thread */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <p className="data-label !mb-0">Response Thread</p>
          </div>
          {loadingResp ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : responses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No responses yet.</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {responses.map((r) => (
                <div
                  key={r.id}
                  className={`p-3 border text-xs ${
                    r.author_type === "admin"
                      ? "border-primary/30 bg-primary/5 ml-4"
                      : r.author_type === "customer"
                      ? "border-border bg-secondary/10"
                      : "border-green-500/20 bg-green-500/5 mr-4"
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span className={`font-bold uppercase tracking-widest text-[10px] ${
                      r.author_type === "admin" ? "text-primary" : r.author_type === "customer" ? "text-foreground" : "text-green-400"
                    }`}>
                      {r.author_type === "admin" ? "Admin" : r.author_type === "customer" ? `Customer: ${r.author_name}` : `Farmer: ${r.author_name}`}
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

          {/* Admin reply box */}
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Add admin note or response..."
              rows={2}
              className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            />
            <button
              onClick={handleReply}
              disabled={sending || !replyText.trim()}
              className="btn-rugged px-4 flex items-center gap-1 disabled:opacity-40 self-start mt-0"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        {!isSettled && (
          <div className="p-4 space-y-3">
            <p className="data-label">Admin Actions</p>

            {/* Resolution note */}
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Resolution note (sent to customer via email)..."
              rows={2}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            />

            {/* Refund checkbox */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={refundApproved}
                onChange={(e) => setRefundApproved(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground">Approve Refund</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">(included in resolution email)</span>
            </label>

            <div className="flex flex-wrap gap-2">
              {dispute.status === "pending" && (
                <button
                  onClick={() => handleStatusChange("under_review")}
                  disabled={updating}
                  className="btn-rugged flex items-center gap-2 px-4 py-2 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40"
                >
                  <Eye className="w-3.5 h-3.5" /> Mark Under Review
                </button>
              )}
              <button
                onClick={() => handleStatusChange("resolved")}
                disabled={updating || !resolutionNote.trim()}
                className="btn-rugged flex items-center gap-2 px-4 py-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Resolve Dispute
              </button>
              <button
                onClick={() => handleStatusChange("rejected")}
                disabled={updating || !resolutionNote.trim()}
                className="btn-rugged flex items-center gap-2 px-4 py-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
            {!resolutionNote.trim() && (
              <p className="text-[10px] text-muted-foreground/60">
                ⚠ Add a resolution note before resolving or rejecting.
              </p>
            )}
          </div>
        )}

        {/* Settled summary */}
        {isSettled && dispute.resolution_note && (
          <div className="p-4">
            <p className="data-label mb-1">Resolution</p>
            <p className="text-sm text-foreground">{dispute.resolution_note}</p>
            {dispute.refund_approved && (
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-widest text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-1">
                <CheckCircle2 className="w-3 h-3" /> Refund Approved
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main DisputesTab ──────────────────────────────────────────────────────

export default function DisputesTab() {
  const [disputes, setDisputes]       = useState<Dispute[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "">("");
  const [batchFilter, setBatchFilter] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDisputes({
        status:   statusFilter || undefined,
        batch_id: batchFilter  || undefined,
      });
      setDisputes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, batchFilter]);

  useEffect(() => { load(); }, [load]);

  const counts: Record<DisputeStatus | "all", number> = {
    all:          disputes.length,
    pending:      disputes.filter(d => d.status === "pending").length,
    under_review: disputes.filter(d => d.status === "under_review").length,
    resolved:     disputes.filter(d => d.status === "resolved").length,
    rejected:     disputes.filter(d => d.status === "rejected").length,
  };

  return (
    <div className="border border-border border-t-0 bg-background">
      {/* Header + Filters */}
      <div className="p-4 border-b border-border bg-secondary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <p className="font-mono text-sm font-bold text-foreground tracking-tighter">DISPUTES</p>
            <span className="font-mono text-xs text-muted-foreground">
              ({counts.all} total · {counts.pending} pending)
            </span>
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Status pill filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(["", "pending", "under_review", "resolved", "rejected"] as const).map((s) => {
            const cfg = s ? STATUS_CONFIG[s] : null;
            const count = s ? counts[s] : counts.all;
            return (
              <button
                key={s || "all"}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                  statusFilter === s
                    ? (cfg ? `${cfg.bgClass} ${cfg.colorClass} border-current` : "bg-foreground/10 text-foreground border-foreground/30")
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cfg && <cfg.icon className="w-3 h-3" />}
                {s ? cfg!.label : "All"} ({count})
              </button>
            );
          })}
        </div>

        {/* Batch search */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value.toUpperCase())}
            placeholder="Filter by Batch ID..."
            className="bg-background border border-border px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-48"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="p-8 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-mono text-muted-foreground">Loading disputes...</p>
        </div>
      ) : disputes.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No disputes found.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {disputes.map((dispute, i) => {
            const cfg      = STATUS_CONFIG[dispute.status];
            const expanded = expandedId === dispute.id;

            return (
              <motion.div
                key={dispute.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {/* Row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : dispute.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors ${
                    dispute.status === "pending" ? "bg-yellow-500/5" : ""
                  }`}
                >
                  {/* Status icon */}
                  <cfg.icon className={`w-4 h-4 shrink-0 ${cfg.colorClass}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {shortId(dispute.id)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {dispute.batch_id}
                      </span>
                      <span className={`text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${cfg.bgClass} ${cfg.colorClass}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {DISPUTE_TYPE_LABELS[dispute.dispute_type]} · {dispute.customer_name}
                      {dispute.farmer_name ? ` · Farmer: ${dispute.farmer_name}` : ""}
                    </p>
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden sm:block">
                    {new Date(dispute.created_at).toLocaleDateString()}
                  </span>

                  {/* Chevron */}
                  {expanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded && (
                    <DisputeDetail
                      dispute={dispute}
                      onUpdated={() => { load(); setExpandedId(null); }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
