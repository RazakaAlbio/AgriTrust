import { motion } from "framer-motion";
import { Activity, CheckCircle, TrendingUp, Clock, ExternalLink, FileDown, QrCode } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { generateCertificatePDF } from "@/lib/generateCertificate";
import QRGenerator from "@/components/QRGenerator";
import { useState } from "react";

const KPI = [
  { label: "Total Scanned", value: "1,247", icon: Activity },
  { label: "Pass Rate", value: "94.2%", icon: CheckCircle, accent: true },
  { label: "Avg Quality", value: "87.6", icon: TrendingUp },
  { label: "Pending Sync", value: "3", icon: Clock, warning: true },
];

const CHART_DATA = [
  { day: "Mon", quality: 88 },
  { day: "Tue", quality: 91 },
  { day: "Wed", quality: 85 },
  { day: "Thu", quality: 92 },
  { day: "Fri", quality: 89 },
  { day: "Sat", quality: 94 },
  { day: "Sun", quality: 91 },
];

const RECENT_SCANS = [
  { id: "B-0847", time: "14:02", result: "PASSED", quality: 92, synced: true },
  { id: "B-0846", time: "13:45", result: "PASSED", quality: 88, synced: true },
  { id: "B-0845", time: "13:12", result: "FAILED", quality: 42, synced: false },
  { id: "B-0844", time: "12:58", result: "PASSED", quality: 95, synced: true },
  { id: "B-0843", time: "12:30", result: "PASSED", quality: 87, synced: true },
  { id: "B-0842", time: "11:55", result: "PASSED", quality: 90, synced: true },
];

const stagger = {
  hidden: { opacity: 0, scale: 0.98 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const },
  }),
};

export default function FarmerDashboard() {
  const [showQR, setShowQR] = useState(false);

  const handleExportPDF = (scan: typeof RECENT_SCANS[0]) => {
    generateCertificatePDF({
      batchId: `BATCH_2024_${scan.id.replace("B-", "")}`,
      result: scan.result,
      quality: scan.quality,
      farmer: "Ahmad Rizal",
      date: "2024-12-15",
      location: "Bandung, West Java",
      hash: "a3f2b8c91d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
      sensors: { weight: "1.24kg", voc: "120ppm", rgb: "#E27D60", temp: "22.4°C" },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
            FARMER_DASHBOARD
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Ahmad Rizal · Last sync: 2 min ago
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQR(!showQR)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] uppercase tracking-widest font-bold transition-colors ${
              showQR ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            QR
          </button>
          <span className="status-dot status-dot-synced" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Online</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-0">
        {/* KPI Cards */}
        <motion.div
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 border border-border"
        >
          {KPI.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              custom={i}
              variants={stagger}
              className={`data-cell flex flex-col gap-2 ${
                kpi.accent ? "border-l-2 border-l-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="data-label">{kpi.label}</p>
                <kpi.icon className={`w-4 h-4 ${
                  kpi.warning ? "text-amber-500" : "text-muted-foreground"
                }`} />
              </div>
              <p className={`font-mono text-3xl font-bold tracking-tighter ${
                kpi.accent ? "text-primary" : "text-foreground"
              }`}>
                {kpi.value}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.2, 1, 0.3, 1] }}
          className="border border-border border-t-0"
        >
          <div className="border-b border-border p-3 flex items-center justify-between">
            <p className="data-label !mb-0">Quality Trend · Last 7 Days</p>
            <p className="text-[10px] uppercase tracking-widest text-primary">Step-Line</p>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CHART_DATA}>
                <CartesianGrid stroke="hsl(0 0% 20%)" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(0 0% 60%)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "hsl(0 0% 20%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(0 0% 60%)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "hsl(0 0% 20%)" }}
                  tickLine={false}
                  domain={[60, 100]}
                />
                <Line
                  type="stepAfter"
                  dataKey="quality"
                  stroke="hsl(33 100% 50%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(33 100% 50%)", stroke: "hsl(0 0% 5%)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Scans Table */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.2, 1, 0.3, 1] }}
          className="border border-border border-t-0"
        >
          <div className="border-b border-border p-3">
            <p className="data-label !mb-0">Recent Grading Sessions</p>
          </div>
          {/* Table Header */}
          <div className="grid grid-cols-6 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="p-3">Batch</div>
            <div className="p-3">Time</div>
            <div className="p-3">Result</div>
            <div className="p-3">Quality</div>
            <div className="p-3">Status</div>
            <div className="p-3">Export</div>
          </div>
          {/* Table Rows */}
          {RECENT_SCANS.map((scan) => (
            <div
              key={scan.id}
              className="grid grid-cols-6 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors"
            >
              <div className="p-3 font-mono text-sm font-medium text-foreground flex items-center gap-2">
                {scan.id}
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="p-3 font-mono text-sm text-muted-foreground">{scan.time}</div>
              <div className="p-3">
                <span className={`font-mono text-xs font-bold uppercase tracking-wider ${
                  scan.result === "PASSED" ? "text-success" : "text-destructive"
                }`}>
                  {scan.result}
                </span>
              </div>
              <div className="p-3 font-mono text-sm text-foreground">{scan.quality}</div>
              <div className="p-3 flex items-center gap-1.5">
                <span className={`status-dot ${scan.synced ? "status-dot-synced" : "status-dot-pending"}`} />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {scan.synced ? "Synced" : "Pending"}
                </span>
              </div>
              <div className="p-3">
                <button
                  onClick={() => handleExportPDF(scan)}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Export PDF Certificate"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </motion.div>

        {/* QR Code Generator */}
        {showQR && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.2, 1, 0.3, 1] as const }}
            className="mt-4"
          >
            <QRGenerator />
          </motion.div>
        )}
      </div>
    </div>
  );
}
