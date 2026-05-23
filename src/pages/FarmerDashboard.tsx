import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Sprout, AlertTriangle, CheckCircle2,
  Clock, Eye, XCircle, ExternalLink, MessageSquare,
  Send, Loader2, Info, LogOut, Package, Star, ShieldAlert,
  ChevronDown, ChevronUp, MapPin, Calendar, LayoutDashboard
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildBlockchainTxUrl } from "@/lib/blockchain";
import { getGradeInfo } from "@/lib/grading";
import {
  fetchDisputesByFarmer,
  submitDisputeResponse,
  DISPUTE_TYPE_LABELS,
  type Dispute,
  type DisputeStatus,
  type DisputeResponse,
} from "@/lib/disputeService";
import { shortId } from "@/lib/emailService";
import FarmerLoginGate from "@/components/FarmerLoginGate";

// ─── Status Config ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<DisputeStatus, {
  label: string; icon: typeof Clock; colorClass: string; bgClass: string;
}> = {
  pending:      { label: "Pending Review", icon: Clock,        colorClass: "text-yellow-400", bgClass: "bg-yellow-500/10 border-yellow-500/30" },
  under_review: { label: "Under Review",   icon: Eye,          colorClass: "text-blue-400",   bgClass: "bg-blue-500/10 border-blue-500/30" },
  resolved:     { label: "Resolved",       icon: CheckCircle2, colorClass: "text-green-400",  bgClass: "bg-green-500/10 border-green-500/30" },
  rejected:     { label: "Rejected",       icon: XCircle,      colorClass: "text-red-400",    bgClass: "bg-red-500/10 border-red-500/30" },
};

// ─── Dispute Card Component ────────────────────────────────────────────────
function DisputeCard({ dispute, farmerName }: { dispute: Dispute; farmerName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [localResponses, setLocalResponses] = useState<DisputeResponse[]>((dispute.responses ?? []) as DisputeResponse[]);
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border border-border bg-background">
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors">
        <cfg.icon className={`w-4 h-4 shrink-0 ${cfg.colorClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-foreground">Dispute {shortId(dispute.id)}</span>
            <span className={`text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${cfg.bgClass} ${cfg.colorClass}`}>{cfg.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {DISPUTE_TYPE_LABELS[dispute.dispute_type]} · {new Date(dispute.created_at).toLocaleDateString()}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="border-t border-border divide-y divide-border">
              <div className="p-4">
                <p className="data-label mb-2">Customer's Description</p>
                <p className="text-sm text-foreground leading-relaxed">{dispute.description}</p>
              </div>

              {dispute.video_link && (
                <div className="p-4 flex items-center gap-3">
                  <p className="data-label !mb-0">Unboxing Video</p>
                  <a href={dispute.video_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline font-mono break-all">
                    <ExternalLink className="w-3 h-3 shrink-0" /> Watch Video
                  </a>
                </div>
              )}

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

              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="data-label !mb-0">Conversation Thread</p>
                </div>

                {localResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No responses yet.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {localResponses.map((r) => (
                      <div key={r.id} className={`p-3 border text-xs ${r.author_type === "admin" ? "border-primary/30 bg-primary/5" : r.author_type === "customer" ? "border-border bg-secondary/10" : "border-green-500/20 bg-green-500/5 ml-4"}`}>
                        <div className="flex justify-between mb-1">
                          <span className={`font-bold uppercase tracking-widest text-[10px] ${r.author_type === "admin" ? "text-primary" : r.author_type === "customer" ? "text-foreground" : "text-green-400"}`}>
                            {r.author_type === "admin" ? "AgriTrust Admin" : r.author_type === "customer" ? "Customer" : `You (${r.author_name})`}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{r.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {dispute.status !== "resolved" && dispute.status !== "rejected" && (
                  <div className="space-y-2">
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Explain your side..." rows={3} className="w-full bg-secondary/10 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none" />
                    {sent && <p className="text-[10px] text-green-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Response sent!</p>}
                    <button onClick={handleReply} disabled={sending || !replyText.trim()} className="btn-rugged flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40">
                      {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5" /> Submit Response</>}
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

// ─── Main Farmer Dashboard ────────────────────────────────────────────────
export default function FarmerDashboard() {
  const [farmer, setFarmer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "disputes">("overview");
  
  // Data State
  const [stats, setStats] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (!farmer) return;
    
    async function loadData() {
      setIsLoading(true);
      
      // Load Scans for Stats
      const { data: farmerScans } = await supabase
        .from('scans')
        .select('*')
        .eq('farmer_id', farmer.id)
        .order('created_at', { ascending: false });

      if (farmerScans) {
        setScans(farmerScans);
        let avgGrade = "N/A";
        let rejectionRate = 0;
        let recentActivity = "No recent activity";
        let total = farmerScans.length;

        if (total > 0) {
          const gradeA = farmerScans.filter(s => s.overall_grade === 'Grade A').length;
          const rejects = farmerScans.filter(s => s.overall_grade === 'Reject').length;
          rejectionRate = Number(((rejects / total) * 100).toFixed(1));
          
          if (gradeA > (total / 2)) avgGrade = "Grade A";
          else if (rejects > (total / 2)) avgGrade = "Reject";
          else avgGrade = "Grade B";
          
          recentActivity = `Submitted batch ${farmerScans[0].batch_id} on ${new Date(farmerScans[0].created_at).toLocaleDateString()}`;
        }

        setStats({ total, avgGrade, rejectionRate, recentActivity });
      }

      // Load Disputes (Only accepted ones)
      const disputeResults = await fetchDisputesByFarmer(farmer.name);
      // Filter out pending and rejected-at-pending disputes
      const acceptedDisputes = disputeResults.filter(d => d.status === "under_review" || d.status === "resolved");
      setDisputes(acceptedDisputes);
      
      setIsLoading(false);
    }
    
    loadData();
  }, [farmer]);

  if (!farmer) {
    return <FarmerLoginGate onLogin={setFarmer} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground flex items-center gap-2">
              <Sprout className="w-5 h-5 text-primary" /> FARMER_<span className="text-primary">PORTAL</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Welcome, {farmer.name}
            </p>
          </div>
        </div>
        <button
          onClick={() => setFarmer(null)}
          className="flex items-center gap-2 px-3 py-1.5 border border-border hover:bg-destructive/10 hover:text-destructive transition-colors text-[10px] uppercase tracking-widest font-bold"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 mt-2">
        {/* Tabs */}
        <div className="flex border border-border mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] uppercase tracking-widest font-bold transition-colors border-r border-border ${activeTab === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </button>
          <button
            onClick={() => setActiveTab("disputes")}
            className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeTab === "disputes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Disputes {disputes.some(d => d.status === "under_review") && <span className="w-2 h-2 rounded-full bg-orange-400 ml-1" />}
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border border-border p-4 bg-secondary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="data-label !mb-0">Total Batches</span>
                    </div>
                    <span className="text-2xl font-mono font-bold text-foreground">{stats?.total}</span>
                  </div>
                  <div className="border border-border p-4 bg-secondary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="data-label !mb-0">Avg Grade</span>
                    </div>
                    <span className={`text-2xl font-mono font-bold ${stats?.avgGrade === "Grade A" ? "text-green-400" : stats?.avgGrade === "Reject" ? "text-destructive" : "text-foreground"}`}>{stats?.avgGrade}</span>
                  </div>
                  <div className="border border-border p-4 bg-secondary/20 md:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4 text-destructive" />
                      <span className="data-label !mb-0">Rejection Rate</span>
                    </div>
                    <div className="flex items-end gap-3">
                      <span className="text-2xl font-mono font-bold text-destructive">{stats?.rejectionRate}%</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-destructive" style={{ width: `${stats?.rejectionRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-border bg-background">
                  <div className="flex items-center justify-between p-4 bg-secondary/10 border-b border-border">
                    <p className="data-label !mb-0">Your Recent Scans</p>
                    <button onClick={() => setShowLog(!showLog)} className="text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-3 py-1 hover:bg-primary/10">
                      {showLog ? "Hide All" : "View All"}
                    </button>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{stats?.recentActivity}</p>
                      <p className="text-xs text-muted-foreground">{scans[0]?.tx_hash ? "✅ Blockchain anchored" : "⏳ Pending blockchain anchor"}</p>
                    </div>
                  </div>
                  {showLog && (
                    <div className="border-t border-border overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-secondary/30 border-b border-border">
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Batch ID</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Date</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Grade</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground text-right">TX</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {scans.map((scan) => {
                            const info = getGradeInfo(scan.overall_grade);
                            return (
                              <tr key={scan.id} className="hover:bg-secondary/20">
                                <td className="p-3 font-mono text-xs font-bold text-foreground">{scan.batch_id}</td>
                                <td className="p-3 text-xs text-muted-foreground">{new Date(scan.created_at).toLocaleDateString()}</td>
                                <td className="p-3"><span className={`font-mono text-xs font-bold ${info.textClass}`}>{scan.overall_grade}</span></td>
                                <td className="p-3 text-right">
                                  {scan.tx_hash ? <a href={buildBlockchainTxUrl(scan.tx_hash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"><ExternalLink className="w-3 h-3" /></a> : <span className="text-[10px] text-muted-foreground/50">Pending</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "disputes" && (
              <motion.div key="disputes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <div className="border border-border bg-secondary/5 p-4 flex items-start gap-3 mb-4">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This tab shows disputes that have been accepted for review by the AgriTrust Admin team. You can provide your side of the story or upload evidence via the thread.
                  </p>
                </div>

                {disputes.length === 0 ? (
                  <div className="border border-border p-8 text-center bg-background">
                    <CheckCircle2 className="w-10 h-10 text-green-400/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">All Clear</p>
                    <p className="text-xs text-muted-foreground">You have no active disputes requiring your attention.</p>
                  </div>
                ) : (
                  disputes.map((dispute) => <DisputeCard key={dispute.id} dispute={dispute} farmerName={farmer.name} />)
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
