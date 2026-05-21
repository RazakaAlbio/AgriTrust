import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  Copy,
  ExternalLink,
  MapPin,
  Calendar,
  User,
  Wifi,
  WifiOff,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Link2,
  Package,
  Scale,
  Wind,
  Microscope,
} from "lucide-react";
import {
  type AIClass,
  type Grade,
  getGradeInfo,
  worstGrade,
  buildTxUrl,
} from "@/lib/grading";

// ── Types ──────────────────────────────────────────────────────────────────
interface Detection {
  aiClass: AIClass;
  confidence: number;
  count: number;
}

interface ScanRecord {
  batchId: string;
  timestamp: string;
  detections: Detection[];
  overallGrade: Grade;
  sensors: {
    weight: { value: string; ok: boolean };
    gas_ppm: { value: string; ok: boolean };
  };
  txHash?: string;
  farmer: string;
  harvestDate: string;
  location: string;
  globalSync: "cloud" | "local";
}

// ── Demo data (shown until Supabase query is wired to ConsumerVerification) ──
const DEMO_DATA: ScanRecord = {
  batchId: "BATCH_2024_0847",
  timestamp: "Dec 15, 2024 · 14:02:31 UTC",
  detections: [
    { aiClass: "ripe",       confidence: 0.91, count: 4 },
    { aiClass: "half_ripe",  confidence: 0.78, count: 1 },
    { aiClass: "mold",       confidence: 0.87, count: 1 },
  ],
  overallGrade: "Reject",
  sensors: {
    weight:  { value: "1.24 kg", ok: true },
    gas_ppm: { value: "142 ppm", ok: true },
  },
  txHash: undefined,    // populated once the scan is anchored on Polygon Amoy
  farmer: "Ahmad Rizal",
  harvestDate: "2024-12-15",
  location: "Bandung, West Java",
  globalSync: "cloud",
};

const TIMELINE_STEPS = [
  { icon: Package, label: "Harvested",        time: "Dec 15 · 06:12", done: true },
  { icon: Cpu,     label: "AI Graded",        time: "Dec 15 · 06:14", done: true },
  { icon: Link2,   label: "Hash Created",     time: "Dec 15 · 06:14", done: true },
  { icon: Cloud,   label: "Blockchain Logged",time: "Dec 15 · 06:15", done: true },
];

const stagger = {
  hidden: { opacity: 0, scale: 0.98 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const },
  }),
};

// ── Component ───────────────────────────────────────────────────────────────
export default function ConsumerVerification() {
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  // TODO: fetch real data from Azure API when backend is live
  // const batchId = searchParams.get("batch");
  // const { data } = useQuery({ queryKey: ["scan", batchId], queryFn: () => fetchScan(batchId) });
  const data: ScanRecord = DEMO_DATA;

  const gradeInfo   = getGradeInfo(
    data.detections.find(d => getGradeInfo(d.aiClass).grade === data.overallGrade)?.aiClass
    ?? data.detections[0]?.aiClass ?? "ripe"
  );
  const isRejected  = data.overallGrade === "Reject";
  const criticalDet = data.detections.filter(d => getGradeInfo(d.aiClass).critical);

  const copyHash = () => {
    navigator.clipboard.writeText(data.txHash ?? data.batchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sensorFlagged = (ok: boolean) =>
    !ok ? "border-destructive bg-destructive/10" : "";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sync Status Bar ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full border-b border-border px-4 py-2 flex items-center justify-between bg-secondary"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {data.batchId}
          </span>
          {/* DEMO badge — remove when Azure backend is live */}
          <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 border border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
            DEMO
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {data.globalSync === "cloud" ? (
            <>
              <Wifi className="w-3.5 h-3.5" style={{ color: "hsl(var(--success))" }} />
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "hsl(var(--success))" }}>
                Cloud Synced
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold">
                Stored Locally
              </span>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Grade Stamp ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 1, 0.3, 1] as const }}
        className={`w-full border-b border-border p-6 flex items-center gap-4 ${
          isRejected ? "bg-destructive" : "bg-success"
        }`}
      >
        {isRejected ? (
          <ShieldX className="w-10 h-10 text-destructive-foreground shrink-0" />
        ) : (
          <ShieldCheck className="w-10 h-10 text-success-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-2xl font-bold tracking-tighter text-success-foreground">
            {data.overallGrade}
          </p>
          <p className="text-xs uppercase tracking-widest text-success-foreground/80 mt-0.5">
            {data.timestamp}
          </p>
        </div>
      </motion.div>

      <div className="max-w-lg mx-auto p-4 space-y-0">

        {/* ── AI Detection Summary ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="border border-border"
        >
          <div className="border-b border-border p-3 flex items-center gap-2">
            <Microscope className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="data-label !mb-0">AI Detection Results</p>
          </div>

          {/* Critical warning banner */}
          {criticalDet.length > 0 && (
            <div className="border-b border-destructive bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-bold uppercase tracking-widest">
                Critical defect detected — {criticalDet.map(d => getGradeInfo(d.aiClass).label).join(", ")}
              </p>
            </div>
          )}

          <div className="divide-y divide-border">
            {data.detections.map((det, i) => {
              const info = getGradeInfo(det.aiClass);
              return (
                <motion.div
                  key={det.aiClass}
                  custom={i}
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-base`}>{info.emoji}</span>
                    <div>
                      <p className={`text-sm font-bold ${info.textClass}`}>
                        {info.label}
                        {info.critical && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-widest bg-red-700/30 text-red-400 px-1 py-0.5">
                            CRITICAL
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Class: {det.aiClass} · ×{det.count}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-bold ${info.textClass}`}>
                      {info.grade}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(det.confidence * 100).toFixed(0)}% conf.
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className={`p-3 border-t border-border flex items-center justify-between ${
            isRejected ? "bg-destructive/10" : "bg-success/10"
          }`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Overall Grade
            </p>
            <p className={`font-mono font-bold text-sm ${
              isRejected ? "text-destructive" : "text-green-400"
            }`}>
              {data.overallGrade}
              {isRejected && criticalDet.length > 0 && " — NOT FOR SALE"}
            </p>
          </div>
        </motion.div>

        {/* ── Sensor Data (only real sensors: weight + gas) ── */}
        <motion.div initial="hidden" animate="show" className="border border-border border-t-0">
          <div className="border-b border-border p-3">
            <p className="data-label !mb-0">Sensor Readings</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {[
              { label: "Weight", sensor: data.sensors.weight,  icon: Scale },
              { label: "Gas / VOC",sensor: data.sensors.gas_ppm, icon: Wind  },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                variants={stagger}
                className={`data-cell ${sensorFlagged(s.sensor.ok)}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="data-label !mb-0">{s.label}</p>
                </div>
                <p className={`data-value ${!s.sensor.ok ? "text-destructive" : ""}`}>
                  {s.sensor.value}
                </p>
                <span className={`status-dot ${
                  s.sensor.ok ? "status-dot-synced" : "status-dot-offline"
                } ml-1 inline-block align-middle`} />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground ml-1">
                  {s.sensor.ok ? "Normal" : "Flagged"}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Trust Timeline ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const }}
          className="border border-border border-t-0"
        >
          <div className="border-b border-border p-3">
            <p className="data-label !mb-0">Trust Timeline</p>
          </div>
          <div className="p-4">
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
              {TIMELINE_STEPS.map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.35, ease: [0.2, 1, 0.3, 1] as const }}
                  className={`relative flex items-start gap-3 ${
                    i < TIMELINE_STEPS.length - 1 ? "pb-5" : ""
                  }`}
                >
                  <div className={`absolute -left-6 w-[18px] h-[18px] border-2 flex items-center justify-center ${
                    step.done ? "border-primary bg-primary" : "border-border bg-secondary"
                  }`}>
                    {step.done && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <step.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      {step.label}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                      {step.time}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Digital Fingerprint ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const }}
          className="border border-border border-t-0"
        >
          <div className="border-b border-border p-3 flex items-center justify-between">
            <p className="data-label !mb-0">Digital Fingerprint (SHA-256)</p>
            <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 border ${
              data.txHash
                ? "border-green-500/50 text-green-400 bg-green-500/10"
                : "border-orange-500/50 text-orange-400 bg-orange-500/10 animate-pulse"
            }`}>
              {data.txHash ? "Anchored" : "Pending"}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-background border border-border p-3 flex items-center gap-2">
              <code className="font-mono text-xs text-muted-foreground break-all flex-1">
                {data.txHash
                  ? data.txHash
                  : "Hash not yet anchored to blockchain"}
              </code>
              {data.txHash && (
                <button
                  onClick={copyHash}
                  className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Copy className="w-5 h-5" />
                </button>
              )}
            </div>
            {copied && (
              <p className="text-[10px] uppercase tracking-widest text-primary">
                Copied to clipboard
              </p>
            )}
            <a
              href={buildTxUrl(data.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn-rugged w-full flex items-center justify-center gap-2 min-h-[48px] text-sm ${
                !data.txHash ? "opacity-60" : ""
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              {data.txHash ? "Verify on PolygonScan" : "Pending Blockchain Anchor"}
            </a>
          </div>
        </motion.div>

        {/* ── Origin Info ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const }}
          className="border border-border border-t-0"
        >
          <div className="border-b border-border p-3">
            <p className="data-label !mb-0">Origin Information</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { icon: User,     label: "Farmer",       value: data.farmer },
              { icon: Calendar, label: "Harvest Date",  value: data.harvestDate },
              { icon: MapPin,   label: "Location",      value: data.location },
            ].map((item) => (
              <div key={item.label} className="p-4 flex items-center gap-3 min-h-[52px]">
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="data-label">{item.label}</p>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Footer ── */}
        <div className="border border-border border-t-0 p-4 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Agri-Trust · Decentralized Edge-AI Grading Hub
          </p>
          <p className="text-[9px] text-muted-foreground/50">
            v3 Model · YOLOv8n · 78.0% mAP@50 · Polygon Amoy · AgriTrustGrading.sol
          </p>
        </div>
      </div>
    </div>
  );
}
