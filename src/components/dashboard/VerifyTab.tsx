import { useState } from "react";
import { motion } from "framer-motion";
import { Search, ShieldCheck, ShieldX, Copy, ExternalLink, AlertTriangle, Scale, Wind, Microscope, User, Calendar, MapPin, CheckCircle2, Package, Cpu, Link2, Cloud } from "lucide-react";
import { type AIClass, type Grade, getGradeInfo, buildTxUrl } from "@/lib/grading";

interface Detection { aiClass: AIClass; confidence: number; count: number; }
interface ScanRecord {
  batchId: string; timestamp: string; detections: Detection[];
  overallGrade: Grade; sensors: { weight: { value: string; ok: boolean }; gas_ppm: { value: string; ok: boolean } };
  txHash?: string; farmer: string; harvestDate: string; location: string;
}

const DEMO_BATCHES: Record<string, ScanRecord> = {
  "BATCH_2024_0847": {
    batchId: "BATCH_2024_0847", timestamp: "Dec 15, 2024 · 14:02 UTC",
    detections: [
      { aiClass: "ripe", confidence: 0.91, count: 4 },
      { aiClass: "half_ripe", confidence: 0.78, count: 1 },
      { aiClass: "mold", confidence: 0.87, count: 1 },
    ],
    overallGrade: "Reject",
    sensors: { weight: { value: "1.24 kg", ok: true }, gas_ppm: { value: "142 ppm", ok: true } },
    farmer: "Ahmad Rizal", harvestDate: "2024-12-15", location: "Bandung, West Java",
  },
  "BATCH_2024_0846": {
    batchId: "BATCH_2024_0846", timestamp: "Dec 15, 2024 · 13:45 UTC",
    detections: [{ aiClass: "ripe", confidence: 0.95, count: 3 }],
    overallGrade: "Grade A",
    sensors: { weight: { value: "1.18 kg", ok: true }, gas_ppm: { value: "98 ppm", ok: true } },
    farmer: "Ahmad Rizal", harvestDate: "2024-12-15", location: "Bandung, West Java",
  },
};

const TIMELINE = [
  { icon: Package, label: "Harvested", time: "06:12", done: true },
  { icon: Cpu, label: "AI Graded", time: "06:14", done: true },
  { icon: Link2, label: "Hash Created", time: "06:14", done: true },
  { icon: Cloud, label: "Blockchain Logged", time: "06:15", done: true },
];

export default function VerifyTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSearch = () => {
    const q = query.trim().toUpperCase();
    const found = DEMO_BATCHES[q] ?? Object.values(DEMO_BATCHES).find(b => b.batchId.includes(q));
    if (found) { setResult(found); setNotFound(false); }
    else { setResult(null); setNotFound(true); }
  };

  const copyHash = () => {
    navigator.clipboard.writeText(result?.txHash ?? result?.batchId ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border border-t-0">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <p className="data-label">Search Batch / Scan QR Code</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="e.g. BATCH_2024_0847"
            className="flex-1 bg-background border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <button onClick={handleSearch}
            className="btn-rugged flex items-center gap-1.5 px-4 py-2 text-sm">
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
        {notFound && <p className="text-xs text-destructive mt-2">Batch not found. Try: BATCH_2024_0847</p>}
      </div>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-border">
          {/* Grade stamp */}
          <div className={`p-4 flex items-center gap-3 ${result.overallGrade === "Reject" ? "bg-destructive/10" : "bg-success/10"}`}>
            {result.overallGrade === "Reject"
              ? <ShieldX className="w-8 h-8 text-destructive" />
              : <ShieldCheck className="w-8 h-8 text-green-400" />}
            <div>
              <p className="font-mono text-xl font-bold tracking-tighter text-foreground">{result.overallGrade}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{result.batchId} · {result.timestamp}</p>
            </div>
          </div>

          {/* Detections */}
          <div>
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Microscope className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="data-label !mb-0">AI Detections</p>
            </div>
            {result.detections.filter(d => getGradeInfo(d.aiClass).critical).length > 0 && (
              <div className="p-3 border-b border-destructive bg-destructive/10 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <p className="text-xs text-destructive font-bold uppercase tracking-widest">Critical defect found</p>
              </div>
            )}
            {result.detections.map(det => {
              const info = getGradeInfo(det.aiClass);
              return (
                <div key={det.aiClass} className="p-3 flex items-center justify-between border-b border-border last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span>{info.emoji}</span>
                    <div>
                      <p className={`text-sm font-bold ${info.textClass}`}>
                        {info.label}
                        {info.critical && <span className="ml-1 text-[9px] bg-red-700/30 text-red-400 px-1 py-0.5">CRITICAL</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">×{det.count}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-bold ${info.textClass}`}>{info.grade}</p>
                    <p className="text-[10px] text-muted-foreground">{(det.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sensors */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {[
              { label: "Weight", v: result.sensors.weight, icon: Scale },
              { label: "Gas / VOC", v: result.sensors.gas_ppm, icon: Wind },
            ].map(s => (
              <div key={s.label} className="data-cell">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="data-label !mb-0">{s.label}</p>
                </div>
                <p className="data-value">{s.v.value}</p>
              </div>
            ))}
          </div>

          {/* Origin */}
          <div>
            {[
              { icon: User, label: "Farmer", value: result.farmer },
              { icon: Calendar, label: "Harvest", value: result.harvestDate },
              { icon: MapPin, label: "Location", value: result.location },
            ].map(item => (
              <div key={item.label} className="p-3 flex items-center gap-3 border-b border-border last:border-b-0">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div><p className="data-label">{item.label}</p><p className="text-sm text-foreground">{item.value}</p></div>
              </div>
            ))}
          </div>

          {/* Blockchain */}
          <div className="p-4 space-y-2">
            <div className="bg-background border border-border p-3 flex items-center gap-2">
              <code className="font-mono text-xs text-muted-foreground break-all flex-1">
                {result.txHash ? `${result.txHash.slice(0, 32)}...` : `${result.batchId} — hash pending`}
              </code>
              <button onClick={copyHash} className="text-muted-foreground hover:text-primary p-2"><Copy className="w-4 h-4" /></button>
            </div>
            {copied && <p className="text-[10px] text-primary uppercase tracking-widest">Copied</p>}
            <a href={buildTxUrl(result.txHash)} target="_blank" rel="noopener noreferrer"
              className="btn-rugged w-full flex items-center justify-center gap-2 min-h-[44px] text-sm">
              <ExternalLink className="w-4 h-4" /> Verify on Blockchain
            </a>
          </div>
        </motion.div>
      )}

      {!result && !notFound && (
        <div className="p-12 text-center">
          <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Enter a Batch ID or scan a QR code to view product details</p>
        </div>
      )}
    </div>
  );
}
