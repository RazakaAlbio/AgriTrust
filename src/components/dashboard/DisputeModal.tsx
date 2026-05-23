import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, AlertTriangle, Send, CheckCircle2, Loader2,
  Link2, MessageSquare, User, Mail, Tag, Video,
} from "lucide-react";
import {
  submitDispute,
  type DisputeType,
  DISPUTE_TYPE_LABELS,
} from "@/lib/disputeService";
import { shortId } from "@/lib/emailService";
import { Link } from "react-router-dom";

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  claimedGrade?: string;
  txHash?: string;
  farmerName?: string;
  farmerId?: string;
}

type FormState = {
  dispute_type: DisputeType | "";
  customer_name: string;
  customer_email: string;
  description: string;
  video_link: string;
};

const DISPUTE_TYPES: { value: DisputeType; label: string; desc: string }[] = [
  { value: "wrong_commodity", label: "Wrong Commodity",       desc: "Received completely different product" },
  { value: "wrong_quality",   label: "Wrong Quality / Grade", desc: "Grade doesn't match physical condition" },
  { value: "wrong_weight",    label: "Wrong Weight",          desc: "Actual weight differs from certified" },
  { value: "other",           label: "Other",                 desc: "Other issue with this batch" },
];

export default function DisputeModal({
  isOpen, onClose, batchId, claimedGrade, txHash, farmerName, farmerId,
}: DisputeModalProps) {
  const [form, setForm] = useState<FormState>({
    dispute_type: "",
    customer_name: "",
    customer_email: "",
    description: "",
    video_link: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const field = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.dispute_type)   e.dispute_type   = "Please select a dispute type";
    if (!form.customer_name.trim())  e.customer_name  = "Your name is required";
    if (!form.customer_email.trim()) e.customer_email = "Your email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email))
      e.customer_email = "Enter a valid email address";
    if (!form.description.trim() || form.description.trim().length < 20)
      e.description = "Please describe the issue (min 20 characters)";
    if (form.video_link.trim() && !/^https?:\/\//i.test(form.video_link))
      e.video_link = "Video link must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { dispute_id } = await submitDispute({
        batch_id:         batchId,
        claimed_grade:    claimedGrade,
        certified_txhash: txHash,
        dispute_type:     form.dispute_type as DisputeType,
        customer_name:    form.customer_name.trim(),
        customer_email:   form.customer_email.trim().toLowerCase(),
        description:      form.description.trim(),
        video_link:       form.video_link.trim() || undefined,
        farmer_name:      farmerName,
        farmer_id:        farmerId,
      });
      setSubmittedId(dispute_id);
    } catch (err) {
      console.error(err);
      setErrors({ description: "Failed to submit. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ dispute_type: "", customer_name: "", customer_email: "", description: "", video_link: "" });
    setErrors({});
    setSubmittedId(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ duration: 0.35, ease: [0.2, 1, 0.3, 1] }}
            className="w-full sm:max-w-lg bg-background border border-border max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                <div>
                  <p className="font-mono text-sm font-bold tracking-tighter text-foreground">
                    REPORT_A_PROBLEM
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                    Batch {batchId} · {claimedGrade ?? "Unknown Grade"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success state */}
            {submittedId ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 text-center flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="font-mono text-lg font-bold text-foreground">Dispute Submitted</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    Reference {shortId(submittedId)}
                  </p>
                </div>
                <div className="w-full bg-secondary/20 border border-border p-4 text-left space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground font-medium">Save your Dispute ID!</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can track the progress of your dispute, view the admin's resolution, and communicate via the tracking portal.
                  </p>
                  <div className="bg-background border border-border p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your Dispute ID</p>
                    <p className="font-mono text-sm text-primary break-all font-bold select-all">
                      {submittedId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="btn-rugged w-full py-3 text-sm mt-2"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="divide-y divide-border">
                {/* Notice */}
                <div className="p-4 bg-orange-500/5 border-b border-orange-500/20 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If the physical product you received does not match the certified batch record above,
                    file a dispute below. Your report is reviewed by our admin team and the farmer will be notified.
                  </p>
                </div>

                {/* Dispute Type */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <p className="data-label !mb-0">Dispute Type <span className="text-orange-400">*</span></p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {DISPUTE_TYPES.map((dt) => (
                      <button
                        key={dt.value}
                        type="button"
                        onClick={() => field("dispute_type", dt.value)}
                        className={`text-left p-3 border transition-colors ${
                          form.dispute_type === dt.value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                        }`}
                      >
                        <p className="text-xs font-bold">{dt.label}</p>
                        <p className="text-[10px] uppercase tracking-widest mt-0.5 opacity-70">{dt.desc}</p>
                      </button>
                    ))}
                  </div>
                  {errors.dispute_type && (
                    <p className="text-[10px] text-destructive">{errors.dispute_type}</p>
                  )}
                </div>

                {/* Contact Info */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="data-label !mb-0">Your Contact Info</p>
                  </div>

                  <div>
                    <label className="data-label block mb-1.5">
                      Full Name <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.customer_name}
                      onChange={(e) => field("customer_name", e.target.value)}
                      placeholder="e.g. Budi Santoso"
                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                    {errors.customer_name && (
                      <p className="text-[10px] text-destructive mt-1">{errors.customer_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="data-label block mb-1.5">
                      Email Address <span className="text-orange-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="email"
                        value={form.customer_email}
                        onChange={(e) => field("customer_email", e.target.value)}
                        placeholder="you@email.com"
                        className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    {errors.customer_email && (
                      <p className="text-[10px] text-destructive mt-1">{errors.customer_email}</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <p className="data-label !mb-0">Issue Details</p>
                  </div>

                  <div>
                    <label className="data-label block mb-1.5">
                      Description <span className="text-orange-400">*</span>
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => field("description", e.target.value)}
                      rows={4}
                      placeholder="Describe what you actually received vs. what was certified. Be specific — e.g. 'All tomatoes were visibly rotten, certified Grade A, received on Dec 18'"
                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                    <div className="flex justify-between mt-1">
                      {errors.description
                        ? <p className="text-[10px] text-destructive">{errors.description}</p>
                        : <span />
                      }
                      <p className="text-[10px] text-muted-foreground/50">{form.description.length} chars</p>
                    </div>
                  </div>

                  <div>
                    <label className="data-label block mb-1.5">
                      Unboxing Video Link <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <div className="relative">
                      <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="url"
                        value={form.video_link}
                        onChange={(e) => field("video_link", e.target.value)}
                        placeholder="https://youtube.com/... or drive.google.com/..."
                        className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors font-mono"
                      />
                    </div>
                    {errors.video_link && (
                      <p className="text-[10px] text-destructive mt-1">{errors.video_link}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      YouTube, Google Drive, TikTok, or any public video link
                    </p>
                  </div>
                </div>

                {/* Submit */}
                <div className="p-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-rugged w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                      : <><Send className="w-4 h-4" /> Submit Dispute Report</>
                    }
                  </button>
                  <p className="text-[9px] text-muted-foreground/50 text-center mt-3 uppercase tracking-widest">
                    Your report is stored on AgriTrust and reviewed by our admin team
                  </p>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
