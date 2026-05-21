import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ExternalLink, FileDown, AlertTriangle } from "lucide-react";
import { generateCertificatePDF } from "@/lib/generateCertificate";
import { getGradeInfo, type Grade } from "@/lib/grading";
import { supabase } from "@/lib/supabase";

interface ScanRow {
  id: string; 
  batchId: string;
  time: string; 
  grade: Grade;
  conf: number; 
  synced: boolean; 
  critical?: boolean; 
  farmer: string;
  aiClass: string;
}

export default function HistoryTab() {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [farmers, setFarmers] = useState<string[]>([]);
  const [farmerFilter, setFarmerFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('scans')
        .select(`
          id,
          batch_id,
          created_at,
          overall_grade,
          confidence_score,
          tx_hash,
          ai_detections,
          farmers (name)
        `)
        .order('created_at', { ascending: false });

      if (data && !error) {
        const formatted: ScanRow[] = data.map((row: any) => {
          const detections = row.ai_detections as any[];
          // Find primary detection for UI class display
          const primaryDet = detections && detections.length > 0 ? detections[0] : null;
          
          return {
            id: row.id,
            batchId: row.batch_id,
            time: new Date(row.created_at).toLocaleString(),
            grade: row.overall_grade as Grade,
            conf: row.confidence_score,
            synced: !!row.tx_hash,
            critical: row.overall_grade === "Reject",
            farmer: row.farmers?.name || "Unknown",
            aiClass: primaryDet ? primaryDet.aiClass : "unknown"
          };
        });

        setScans(formatted);
        setFarmers([...new Set(formatted.map(s => s.farmer))]);
      }
      setIsLoading(false);
    }
    
    fetchHistory();
  }, []);

  const filtered = scans.filter(s => {
    if (farmerFilter && s.farmer !== farmerFilter) return false;
    if (gradeFilter && s.grade !== gradeFilter) return false;
    return true;
  });

  const handleExport = (scan: ScanRow) => {
    generateCertificatePDF({
      batchId:  scan.batchId,
      result:   scan.grade,
      quality:  Math.round(scan.conf * 100),
      farmer:   scan.farmer,
      date:     scan.time.split(',')[0],
      location: "Verified by Agri-Trust",
      txHash:   "",   // tx_hash not fetched in list view — open detail to verify
      sensors:  { weight: "See scan details", gas_ppm: "See scan details" },
    });
  };


  return (
    <div className="border border-border border-t-0 bg-background">
      {/* Filters */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row flex-wrap gap-3 bg-secondary/10">
        <div className="flex-1 min-w-[140px]">
          <p className="data-label mb-1">Farmer</p>
          <select value={farmerFilter} onChange={e => setFarmerFilter(e.target.value)}
            className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary">
            <option value="">All Farmers</option>
            {farmers.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <p className="data-label mb-1">Grade</p>
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
            className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary">
            <option value="">All Grades</option>
            <option value="Grade A">Grade A</option>
            <option value="Grade B">Grade B</option>
            <option value="Grade C">Grade C</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
      </div>

      {/* Table/List View */}
      {isLoading ? (
        <div className="p-8 text-center text-sm font-mono text-muted-foreground">Loading history from Supabase...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No scans match your filters.</div>
      ) : (
        <div className="overflow-x-auto">
          {/* Desktop Table View */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Batch ID</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Time</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Farmer</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Grade</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Confidence</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal text-center">Sync</th>
                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((scan, i) => {
                const info = getGradeInfo(scan.aiClass as any);
                return (
                  <motion.tr key={scan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`hover:bg-secondary/20 transition-colors ${scan.critical ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 font-mono text-xs text-foreground font-bold">{scan.batchId}</td>
                    <td className="p-3 text-xs text-muted-foreground">{scan.time}</td>
                    <td className="p-3 text-xs text-foreground font-medium">{scan.farmer}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{info.emoji}</span>
                        <span className={`font-mono text-xs font-bold ${info.textClass}`}>{scan.grade}</span>
                        {scan.critical && <AlertTriangle className="w-3 h-3 text-destructive ml-1" />}
                      </div>
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{(scan.conf * 100).toFixed(0)}%</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${scan.synced ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-orange-500 animate-pulse"}`} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-border"><ExternalLink className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleExport(scan)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-border"><FileDown className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map((scan, i) => {
              const info = getGradeInfo(scan.aiClass as any);
              return (
                <motion.div key={scan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`p-4 space-y-3 ${scan.critical ? "bg-destructive/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-foreground font-bold">{scan.batchId}</p>
                      <p className="text-[10px] text-muted-foreground">{scan.time}</p>
                    </div>
                    <span className={`inline-block w-2 h-2 rounded-full ${scan.synced ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-orange-500 animate-pulse"}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Farmer</p>
                      <p className="text-xs text-foreground font-medium">{scan.farmer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Result</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm">{info.emoji}</span>
                        <span className={`font-mono text-xs font-bold ${info.textClass}`}>{scan.grade}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <button className="flex-1 btn-rugged py-1.5 text-[10px] flex items-center justify-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Verify
                    </button>
                    <button onClick={() => handleExport(scan)} className="flex-1 btn-rugged py-1.5 text-[10px] flex items-center justify-center gap-1">
                      <FileDown className="w-3 h-3" /> Certificate
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
