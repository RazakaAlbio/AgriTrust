import { useState } from "react";
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
} from "lucide-react";

/* ── Mock data ─────────────────────────────────────────────── */
const MOCK_DATA = {
  status: "PASSED" as "PASSED" | "FAILED",
  batchId: "BATCH_2024_0847",
  sensors: {
    weight: { value: "1.24kg", ok: true },
    voc: { value: "120ppm", ok: true },
    rgb: { value: "#E27D60", ok: true },
    temp: { value: "22.4°C", ok: true },
  },
  hash: "a3f2b8c91d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
  farmer: "Ahmad Rizal",
  harvestDate: "2024-12-15",
  location: "Bandung, West Java",
  timestamp: "14:02:31 UTC",
  globalSync: "cloud" as "cloud" | "local",
};

const TIMELINE_STEPS = [
  { icon: Package, label: "Harvested", time: "Dec 15 · 06:12", done: true },
  { icon: Cpu, label: "AI Graded", time: "Dec 15 · 06:14", done: true },
  { icon: Link2, label: "Hash Created", time: "Dec 15 · 06:14", done: true },
  { icon: Cloud, label: "Blockchain Logged", time: "Dec 15 · 06:15", done: true },
];

/* ── Animation helpers ─────────────────────────────────────── */
const stagger = {
  hidden: { opacity: 0, scale: 0.98 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const },
  }),
};

/* ── Component ─────────────────────────────────────────────── */
export default function ConsumerVerification() {
  const [copied, setCopied] = useState(false);
  const passed = MOCK_DATA.status === "PASSED";

  const copyHash = () => {
    navigator.clipboard.writeText(MOCK_DATA.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sensorFlagged = (ok: boolean) =>
    !ok ? "border-destructive bg-destructive/10" : "";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Global Sync Status Bar ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full border-b border-border px-4 py-2 flex items-center justify-between bg-secondary"
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {MOCK_DATA.batchId}
        </span>
        <div className="flex items-center gap-1.5">
          {MOCK_DATA.globalSync === "cloud" ? (
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

      {/* ── Status Stamp ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 1, 0.3, 1] as const }}
        className={`w-full border-b border-border p-6 flex items-center gap-4 ${
          passed ? "bg-success" : "bg-destructive"
        }`}
      >
        {passed ? (
          <ShieldCheck className="w-10 h-10 text-success-foreground" />
        ) : (
          <ShieldX className="w-10 h-10 text-destructive-foreground" />
        )}
        <div>
          <p className="font-mono text-2xl font-bold tracking-tighter text-success-foreground">
            GRADED: {MOCK_DATA.status}
          </p>
          <p className="text-xs uppercase tracking-widest text-success-foreground/80 mt-0.5">
            {MOCK_DATA.timestamp}
          </p>
        </div>
      </motion.div>

      <div className="max-w-lg mx-auto p-4 space-y-0">
        {/* ── Explainable AI Notice (only on FAIL) ── */}
        {!passed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="border border-destructive bg-destructive/10 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-destructive">
                AI Explanation
              </p>
              <p className="text-sm text-foreground mt-1">
                One or more sensor readings exceeded acceptable thresholds.
                Flagged values are highlighted in red below.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Sensor Data ── */}
        <motion.div initial="hidden" animate="show" className="border border-border">
          <div className="border-b border-border p-3">
            <p className="data-label !mb-0">Sensor Readings</p>
          </div>
          <div className="grid grid-cols-2">
            {[
              { label: "Weight", sensor: MOCK_DATA.sensors.weight, icon: "⚖️" },
              { label: "VOC Level", sensor: MOCK_DATA.sensors.voc, icon: "💨" },
              { label: "Temperature", sensor: MOCK_DATA.sensors.temp, icon: "🌡️" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                variants={stagger}
                className={`data-cell ${sensorFlagged(s.sensor.ok)}`}
              >
                <p className="data-label">{s.label}</p>
                <p className={`data-value ${!s.sensor.ok ? "text-destructive" : ""}`}>
                  {s.sensor.value}
                </p>
                <span
                  className={`status-dot ${
                    s.sensor.ok ? "status-dot-synced" : "status-dot-offline"
                  } ml-1 inline-block align-middle`}
                />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground ml-1">
                  {s.sensor.ok ? "Synced" : "Flagged"}
                </span>
              </motion.div>
            ))}
            {/* RGB with swatch */}
            <motion.div
              custom={3}
              variants={stagger}
              className={`data-cell ${sensorFlagged(MOCK_DATA.sensors.rgb.ok)}`}
            >
              <p className="data-label">Color Spectrum</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 border border-border"
                  style={{ backgroundColor: MOCK_DATA.sensors.rgb.value }}
                />
                <p
                  className={`font-mono text-xl font-bold tracking-tighter ${
                    !MOCK_DATA.sensors.rgb.ok ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {MOCK_DATA.sensors.rgb.value}
                </p>
              </div>
              <span
                className={`status-dot ${
                  MOCK_DATA.sensors.rgb.ok ? "status-dot-synced" : "status-dot-offline"
                } mt-1 inline-block`}
              />
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground ml-1">
                {MOCK_DATA.sensors.rgb.ok ? "Synced" : "Flagged"}
              </span>
            </motion.div>
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
              {/* vertical line */}
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
                  <div
                    className={`absolute -left-6 w-[18px] h-[18px] border-2 flex items-center justify-center ${
                      step.done
                        ? "border-primary bg-primary"
                        : "border-border bg-secondary"
                    }`}
                  >
                    {step.done && (
                      <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                    )}
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
          <div className="border-b border-border p-3">
            <p className="data-label !mb-0">Digital Fingerprint (SHA-256)</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-background border border-border p-3 flex items-center gap-2">
              <code className="font-mono text-xs text-muted-foreground break-all flex-1">
                {MOCK_DATA.hash.slice(0, 32)}...
              </code>
              <button
                onClick={copyHash}
                className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            {copied && (
              <p className="text-[10px] uppercase tracking-widest text-primary">
                Hash copied to clipboard
              </p>
            )}
            <button className="btn-rugged w-full flex items-center justify-center gap-2 min-h-[48px] text-sm">
              <ExternalLink className="w-4 h-4" />
              Verify on Blockchain
            </button>
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
              { icon: User, label: "Farmer", value: MOCK_DATA.farmer },
              { icon: Calendar, label: "Harvest Date", value: MOCK_DATA.harvestDate },
              { icon: MapPin, label: "Location", value: MOCK_DATA.location },
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
        <div className="border border-border border-t-0 p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Agri-Trust · Decentralized Edge-AI Grading Hub
          </p>
        </div>
      </div>
    </div>
  );
}
