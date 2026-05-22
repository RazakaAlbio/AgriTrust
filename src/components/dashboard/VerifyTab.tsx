import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldCheck, ShieldX, Copy, ExternalLink, AlertTriangle, Scale, Wind, Microscope, User, Calendar, MapPin, QrCode, X, CheckCircle2, FileDown, Tag, TrendingUp } from "lucide-react";
import { type AIClass, type Grade, getGradeInfo, buildTxUrl } from "@/lib/grading";
import { generateCertificatePDF } from "@/lib/generateCertificate";
import { supabase } from "@/lib/supabase";

interface Detection { aiClass: AIClass; confidence: number; count: number; }
interface ScanRecord {
  batchId: string; timestamp: string; detections: Detection[];
  overallGrade: Grade; sensors: { weight: { value: string; ok: boolean }; gas_ppm: { value: string; ok: boolean } };
  txHash?: string; farmer: string; harvestDate: string; location: string;
  imageUrl?: string;
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
    imageUrl: "https://images.unsplash.com/photo-1595858603623-86873531b7f0?q=80&w=400&auto=format&fit=crop"
  },
  "BATCH_2024_0846": {
    batchId: "BATCH_2024_0846", timestamp: "Dec 15, 2024 · 13:45 UTC",
    detections: [{ aiClass: "ripe", confidence: 0.95, count: 3 }],
    overallGrade: "Grade A",
    sensors: { weight: { value: "1.18 kg", ok: true }, gas_ppm: { value: "98 ppm", ok: true } },
    farmer: "Ahmad Rizal", harvestDate: "2024-12-15", location: "Bandung, West Java",
    imageUrl: "https://images.unsplash.com/photo-1595858603623-86873531b7f0?q=80&w=400&auto=format&fit=crop"
  },
};

export default function VerifyTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;

    setIsLoading(true);
    setNotFound(false);
    setResult(null);

    try {
      const { data, error } = await supabase
        .from('scans')
        .select(`
          batch_id, 
          created_at, 
          overall_grade, 
          weight_kg, 
          gas_ppm, 
          ai_detections, 
          image_url, 
          tx_hash,
          farmers (name, location)
        `)
        .eq('batch_id', q)
        .single();

      if (error || !data) {
        // Fallback to demo data if Supabase fails (e.g. testing locally without DB)
        const found = DEMO_BATCHES[q] ?? Object.values(DEMO_BATCHES).find(b => b.batchId.includes(q));
        if (found) { setResult(found); setNotFound(false); setShowQRScanner(false); }
        else { setResult(null); setNotFound(true); }
      } else {
        // Map Supabase response to ScanRecord interface
        const record: ScanRecord = {
          batchId: data.batch_id,
          timestamp: new Date(data.created_at).toLocaleString(),
          detections: data.ai_detections as Detection[],
          overallGrade: data.overall_grade as Grade,
          sensors: {
            weight: { value: `${data.weight_kg} kg`, ok: true },
            gas_ppm: { value: `${data.gas_ppm} ppm`, ok: true }
          },
          txHash: data.tx_hash,
          farmer: (data.farmers as any)?.name || "Unknown",
          harvestDate: new Date(data.created_at).toISOString().split('T')[0],
          location: (data.farmers as any)?.location || "Unknown",
          imageUrl: data.image_url
        };
        setResult(record);
        setNotFound(false);
        setShowQRScanner(false);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  const copyHash = () => {
    navigator.clipboard.writeText(result?.txHash ?? result?.batchId ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    generateCertificatePDF({
      batchId:  result.batchId,
      result:   result.overallGrade,
      quality:  Math.round((result.detections[0]?.confidence || 0) * 100),
      farmer:   result.farmer,
      date:     result.harvestDate,
      location: result.location,
      txHash:   result.txHash ?? "",
      sensors:  {
        weight:  result.sensors.weight.value,
        gas_ppm: result.sensors.gas_ppm.value,
      },
    });
  };

  // Simulate scanning a QR code successfully after 3 seconds
  useEffect(() => {
    if (showQRScanner) {
      setIsScanning(true);
      const timer = setTimeout(() => {
        setQuery("BATCH_2024_0846");
        setIsScanning(false);
        // Auto search after a brief pause so user sees the text populate
        setTimeout(() => {
          const found = DEMO_BATCHES["BATCH_2024_0846"];
          setResult(found);
          setNotFound(false);
          setShowQRScanner(false);
        }, 800);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showQRScanner]);

  return (
    <div className="border border-border border-t-0 flex flex-col min-h-[600px] bg-background">
      {/* Search Bar & Actions */}
      <div className="p-4 border-b border-border bg-secondary/10">
        <p className="data-label mb-2">Search Batch / Scan Product QR</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. BATCH_2024_0847"
              className="w-full bg-background border border-border pl-9 pr-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" 
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSearch} disabled={isLoading} className="btn-rugged flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2 text-sm disabled:opacity-50">
              {isLoading ? "Searching..." : "Verify"}
            </button>
            <button 
              onClick={() => setShowQRScanner(!showQRScanner)}
              className={`flex items-center justify-center gap-2 px-4 py-2 border transition-colors ${
                showQRScanner ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>
        {notFound && <p className="text-xs text-destructive mt-2">Batch not found. Try: BATCH_2024_0847</p>}
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1">
        
        {/* Simulated Camera Overlay */}
        <AnimatePresence>
          {showQRScanner && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center p-4"
            >
              <button 
                onClick={() => setShowQRScanner(false)} 
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center mb-6">
                <p className="font-mono text-sm text-white font-bold mb-1">CAMERA ACTIVE</p>
                <p className="text-xs text-white/50">Point your camera at the Agri-Trust product QR code.</p>
              </div>

              {/* Viewfinder Frame */}
              <div className="relative w-64 h-64 border-2 border-white/20 rounded-lg overflow-hidden">
                {/* Scanning Laser */}
                {isScanning && (
                  <motion.div 
                    animate={{ y: [0, 250, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 left-0 right-0 h-1 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)] z-10"
                  />
                )}
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary" />
                
                {/* Fake camera feed background */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595858603623-86873531b7f0?q=80&w=400&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-luminosity" />
              </div>
              
              <div className="mt-6 flex items-center gap-2">
                {isScanning ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    <span className="text-[10px] uppercase tracking-widest text-primary">Scanning...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-[10px] uppercase tracking-widest text-green-400">QR Code Detected</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Data */}
        {result ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-border h-full">
            {/* Grade stamp */}
            <div className={`p-6 flex items-center gap-4 ${result.overallGrade === "Reject" ? "bg-destructive/10" : "bg-success/10"}`}>
              {result.overallGrade === "Reject"
                ? <ShieldX className="w-10 h-10 text-destructive" />
                : <ShieldCheck className="w-10 h-10 text-green-400" />}
              <div>
                <p className="font-mono text-2xl font-bold tracking-tighter text-foreground">{result.overallGrade}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{result.batchId} · {result.timestamp}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left Col: Image & Detections */}
              <div>
                {result.imageUrl && (
                  <div className="border-b border-border p-4 bg-secondary/5">
                    <p className="data-label mb-2">Scan Snapshot</p>
                    <div className="relative aspect-video rounded overflow-hidden border border-border">
                      <img src={result.imageUrl} alt="Commodity scan" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white flex items-center gap-1.5">
                        <Microscope className="w-3 h-3 text-primary" /> AI Verified
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-4 border-b border-border flex items-center gap-2 bg-secondary/10">
                  <Microscope className="w-4 h-4 text-muted-foreground" />
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
                    <div key={det.aiClass} className="p-4 flex items-center justify-between border-b border-border last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{info.emoji}</span>
                        <div>
                          <p className={`text-sm font-bold ${info.textClass}`}>
                            {info.label}
                            {info.critical && <span className="ml-2 text-[9px] bg-red-700/30 text-red-400 px-1 py-0.5">CRITICAL</span>}
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

              {/* Right Col: Origin & Blockchain */}
              <div className="divide-y divide-border">
                {/* Sensors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">
                  {[
                    { label: "Weight", v: result.sensors.weight, icon: Scale },
                    { label: "Gas / VOC", v: result.sensors.gas_ppm, icon: Wind },
                  ].map(s => (
                    <div key={s.label} className="p-4 bg-secondary/5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <s.icon className="w-4 h-4 text-muted-foreground" />
                        <p className="data-label !mb-0">{s.label}</p>
                      </div>
                      <p className="text-xl font-mono font-bold text-foreground">{s.v.value}</p>
                    </div>
                  ))}
                </div>

                {/* Origin */}
                <div className="p-4 space-y-4">
                  {[
                    { icon: User, label: "Farmer", value: result.farmer },
                    { icon: Calendar, label: "Harvest", value: result.harvestDate },
                    { icon: MapPin, label: "Location", value: result.location },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3">
                      <item.icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="data-label">{item.label}</p>
                        <p className="text-sm font-medium text-foreground">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tomato Market Price Reference */}
                <div className="p-4 bg-secondary/5 border-b border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-primary" />
                    <p className="data-label !mb-0">Suggested Market Price</p>
                  </div>
                  <div className="border border-border bg-background p-3 rounded">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Based on {result.overallGrade}
                    </p>
                    <p className={`font-mono text-lg font-bold ${
                      result.overallGrade === "Reject" ? "text-red-400" :
                      result.overallGrade === "Grade A" ? "text-green-400" :
                      result.overallGrade === "Grade B" ? "text-yellow-400" : "text-orange-400"
                    }`}>
                      {result.overallGrade === "Grade A" ? "Rp 20.000 - 35.000 / kg" :
                       result.overallGrade === "Grade B" ? "Rp 12.000 - 20.000 / kg" :
                       result.overallGrade === "Grade C" ? "Rp 5.000 - 12.000 / kg" :
                       "Tidak Layak / Jangan dibeli"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[9px] text-muted-foreground">Panel Harga Bapanas & PIHPS (2024-2025)</p>
                  </div>
                </div>

                {/* Blockchain */}
                <div className="p-4 bg-secondary/10">
                  <p className="data-label mb-3">Blockchain Integrity</p>
                  <div className="space-y-3">
                    <div className="bg-background border border-border p-3 flex items-center gap-2">
                      <code className="font-mono text-xs text-muted-foreground break-all flex-1">
                        {result.txHash ? `${result.txHash.slice(0, 32)}...` : `${result.batchId} — hash pending`}
                      </code>
                      <button onClick={copyHash} className="text-muted-foreground hover:text-primary transition-colors p-1"><Copy className="w-4 h-4" /></button>
                    </div>
                    {copied && <p className="text-[10px] text-primary uppercase tracking-widest text-right">Copied</p>}
                    {result.txHash ? (
                      <a
                        href={buildTxUrl(result.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-rugged w-full flex items-center justify-center gap-2 min-h-[44px] text-sm"
                      >
                        <ExternalLink className="w-4 h-4" /> Verify on Polygon Explorer
                      </a>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm border border-border text-muted-foreground/50 cursor-not-allowed bg-secondary/20">
                        <ExternalLink className="w-4 h-4" />
                        <span>Not yet anchored on-chain</span>
                      </div>
                    )}
                    <button
                      onClick={handleDownloadPDF}
                      className="btn-rugged w-full flex items-center justify-center gap-2 min-h-[44px] text-sm bg-secondary/50 hover:bg-secondary border-border mt-3"
                    >
                      <FileDown className="w-4 h-4 text-muted-foreground" />
                      Download PDF Certificate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : !notFound && !showQRScanner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-secondary/5">
            <Search className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-bold text-foreground mb-1">Verify Product Authenticity</p>
            <p className="text-sm text-muted-foreground max-w-sm">Enter a specific Batch ID manually, or click the QR Code icon to scan the product label with your camera.</p>
          </div>
        )}
      </div>
    </div>
  );
}
