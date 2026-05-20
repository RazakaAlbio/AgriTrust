import { motion } from "framer-motion";
import { ExternalLink, FileDown, AlertTriangle } from "lucide-react";
import { generateCertificatePDF } from "@/lib/generateCertificate";
import { getGradeInfo, type AIClass, type Grade } from "@/lib/grading";
import { useState } from "react";

interface ScanRow {
  id: string; time: string; aiClass: AIClass; grade: Grade;
  conf: number; synced: boolean; critical?: boolean; farmer: string;
}

const ALL_SCANS: ScanRow[] = [
  { id: "B-0847", time: "14:02", aiClass: "ripe",           grade: "Grade A", conf: 0.91, synced: true,  farmer: "Ahmad Rizal" },
  { id: "B-0846", time: "13:45", aiClass: "mold",           grade: "Reject",  conf: 0.87, synced: true,  critical: true, farmer: "Ahmad Rizal" },
  { id: "B-0845", time: "13:12", aiClass: "unripe",         grade: "Grade C", conf: 0.78, synced: false, farmer: "Siti Nurhaliza" },
  { id: "B-0844", time: "12:58", aiClass: "ripe",           grade: "Grade A", conf: 0.95, synced: true,  farmer: "Ahmad Rizal" },
  { id: "B-0843", time: "12:30", aiClass: "half_ripe",      grade: "Grade B", conf: 0.82, synced: true,  farmer: "Siti Nurhaliza" },
  { id: "B-0842", time: "11:55", aiClass: "fruit_cracking", grade: "Reject",  conf: 0.74, synced: true,  farmer: "Ahmad Rizal" },
  { id: "B-0841", time: "11:20", aiClass: "ripe",           grade: "Grade A", conf: 0.93, synced: true,  farmer: "Budi Santoso" },
  { id: "B-0840", time: "10:45", aiClass: "rotten",         grade: "Reject",  conf: 0.89, synced: true,  critical: true, farmer: "Budi Santoso" },
];

export default function HistoryTab() {
  const [farmerFilter, setFarmerFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");

  const farmers = [...new Set(ALL_SCANS.map(s => s.farmer))];
  const filtered = ALL_SCANS.filter(s => {
    if (farmerFilter && s.farmer !== farmerFilter) return false;
    if (gradeFilter && s.grade !== gradeFilter) return false;
    return true;
  });

  const handleExport = (scan: ScanRow) => {
    generateCertificatePDF({
      batchId: `BATCH_2024_${scan.id.replace("B-", "")}`,
      result: scan.grade, quality: Math.round(scan.conf * 100),
      farmer: scan.farmer, date: "2024-12-15", location: "Bandung, West Java",
      hash: "a3f2b8c9...pending", sensors: { weight: "1.24kg", voc: "142ppm", rgb: "", temp: "" },
    });
  };

  return (
    <div className="border border-border border-t-0">
      {/* Filters */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <p className="data-label">Farmer</p>
          <select value={farmerFilter} onChange={e => setFarmerFilter(e.target.value)}
            className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary">
            <option value="">All Farmers</option>
            {farmers.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <p className="data-label">Grade</p>
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
            className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary">
            <option value="">All Grades</option>
            <option value="Grade A">Grade A</option>
            <option value="Grade B">Grade B</option>
            <option value="Grade C">Grade C</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
        <div className="sm:ml-auto self-end">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {filtered.length} of {ALL_SCANS.length} scans
          </p>
        </div>
      </div>

      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="p-3">Batch</div>
          <div className="p-3">Time</div>
          <div className="p-3">Farmer</div>
          <div className="p-3">Class</div>
          <div className="p-3">Grade</div>
          <div className="p-3">Sync</div>
          <div className="p-3">PDF</div>
        </div>
        {filtered.map((scan, i) => {
          const info = getGradeInfo(scan.aiClass);
          return (
            <motion.div key={scan.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-7 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors ${
                scan.critical ? "bg-red-950/20" : ""
              }`}>
              <div className="p-3 font-mono text-sm font-medium text-foreground flex items-center gap-1">
                {scan.id} <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="p-3 font-mono text-sm text-muted-foreground">{scan.time}</div>
              <div className="p-3 text-xs text-foreground truncate">{scan.farmer}</div>
              <div className="p-3 flex items-center gap-1">
                {scan.critical && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                <span className={`text-xs font-bold ${info.textClass}`}>{info.label}</span>
                <span className="text-[10px] text-muted-foreground">{(scan.conf*100).toFixed(0)}%</span>
              </div>
              <div className="p-3">
                <span className={`font-mono text-xs font-bold ${info.textClass}`}>{scan.grade}</span>
              </div>
              <div className="p-3 flex items-center gap-1">
                <span className={`status-dot ${scan.synced ? "status-dot-synced" : "status-dot-pending"}`} />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {scan.synced ? "Synced" : "Pending"}
                </span>
              </div>
              <div className="p-3">
                <button onClick={() => handleExport(scan)} className="text-muted-foreground hover:text-primary transition-colors" title="Export PDF">
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Mobile Cards (hidden on desktop) */}
      <div className="md:hidden divide-y divide-border">
        {filtered.map((scan, i) => {
          const info = getGradeInfo(scan.aiClass);
          return (
            <motion.div key={scan.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`p-4 space-y-2 ${scan.critical ? "bg-red-950/20" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">{scan.id}</span>
                  <span className="font-mono text-xs text-muted-foreground">{scan.time}</span>
                </div>
                <button onClick={() => handleExport(scan)} className="text-muted-foreground hover:text-primary p-1" title="Export PDF">
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {scan.critical && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  <span className={`text-sm font-bold ${info.textClass}`}>{info.label}</span>
                  <span className="text-[10px] text-muted-foreground">{(scan.conf*100).toFixed(0)}%</span>
                </div>
                <span className={`font-mono text-xs font-bold ${info.textClass}`}>{scan.grade}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
                <span>{scan.farmer}</span>
                <div className="flex items-center gap-1">
                  <span className={`status-dot ${scan.synced ? "status-dot-synced" : "status-dot-pending"}`} />
                  {scan.synced ? "Synced" : "Pending"}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">No scans match the selected filters.</div>
      )}
    </div>
  );
}
