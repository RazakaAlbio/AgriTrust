import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Package, ShieldAlert, Star, MapPin, Calendar, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildBlockchainTxUrl } from "@/lib/blockchain";
import { getGradeInfo } from "@/lib/grading";

interface FarmerProfile {
  id: string;
  name: string;
  location: string;
  joinedDate: string;
  totalBatches: number;
  averageGrade: string;
  rejectionRate: number;
  recentActivity: string;
}

export default function FarmersTab() {
  const [query, setQuery] = useState("");
  const [farmersList, setFarmersList] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerProfile | null>(null);
  const [farmerScans, setFarmerScans] = useState<any[]>([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    async function fetchFarmers() {
      const { data } = await supabase.from('farmers').select('*');
      if (data) setFarmersList(data);
    }
    fetchFarmers();
  }, []);

  const handleSelectFarmer = async (farmer: any) => {
    setShowLog(false);
    setFarmerScans([]);

    // Fetch all scans for the selected farmer
    const { data: scans } = await supabase
      .from('scans')
      .select('id, batch_id, created_at, overall_grade, confidence_score, tx_hash')
      .eq('farmer_id', farmer.id)
      .order('created_at', { ascending: false });
    
    let totalBatches = 0;
    let avgGrade = "N/A";
    let rejectionRate = 0;
    let recentActivity = "No recent activity";
    
    if (scans && scans.length > 0) {
      totalBatches = scans.length;
      
      const gradeA = scans.filter(s => s.overall_grade === 'Grade A').length;
      const rejects = scans.filter(s => s.overall_grade === 'Reject').length;
      
      rejectionRate = Number(((rejects / totalBatches) * 100).toFixed(1));
      
      if (gradeA > (totalBatches / 2)) avgGrade = "Grade A";
      else if (rejects > (totalBatches / 2)) avgGrade = "Reject";
      else avgGrade = "Grade B";
      
      const lastScanDate = new Date(scans[0].created_at);
      recentActivity = `Submitted batch ${scans[0].batch_id} on ${lastScanDate.toLocaleDateString()}`;
      setFarmerScans(scans);
    }

    setSelectedFarmer({
      id: farmer.id,
      name: farmer.name,
      location: farmer.location,
      joinedDate: new Date(farmer.joined_date || farmer.created_at).toISOString().split('T')[0],
      totalBatches,
      averageGrade: avgGrade,
      rejectionRate,
      recentActivity
    });
  };

  const filteredFarmers = farmersList.filter(f => 
    f.name.toLowerCase().includes(query.toLowerCase()) || 
    f.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="border border-border border-t-0 flex flex-col md:flex-row min-h-[600px] bg-background">
      {/* Sidebar List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="data-label mb-2">Search Farmers</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Name or ID..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-secondary/50 border border-border pl-9 pr-3 py-2 font-mono text-sm focus:outline-none focus:border-primary text-foreground"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredFarmers.map(farmer => (
            <button
              key={farmer.id}
              onClick={() => handleSelectFarmer(farmer)}
              className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-secondary/50 ${
                selectedFarmer?.id === farmer.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-foreground">{farmer.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{farmer.location}</span>
              </div>
            </button>
          ))}
          {filteredFarmers.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No farmers found.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 relative">
        <AnimatePresence mode="wait">
          {selectedFarmer ? (
            <motion.div
              key={selectedFarmer.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Profile Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center border border-border">
                      <User className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tighter text-foreground">{selectedFarmer.name}</h2>
                      <p className="font-mono text-xs text-primary max-w-xs truncate">{selectedFarmer.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {selectedFarmer.location}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Joined {selectedFarmer.joinedDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-border p-4 bg-secondary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="data-label !mb-0">Total Batches</span>
                  </div>
                  <span className="text-2xl font-mono font-bold text-foreground">{selectedFarmer.totalBatches}</span>
                </div>
                <div className="border border-border p-4 bg-secondary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="data-label !mb-0">Avg Grade</span>
                  </div>
                  <span className={`text-2xl font-mono font-bold ${
                    selectedFarmer.averageGrade === "Grade A" ? "text-green-400" :
                    selectedFarmer.averageGrade === "Grade B" ? "text-blue-400" :
                    selectedFarmer.averageGrade === "Reject" ? "text-destructive" :
                    "text-foreground"
                  }`}>{selectedFarmer.averageGrade}</span>
                </div>
                <div className="border border-border p-4 bg-secondary/20 md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4 text-destructive" />
                    <span className="data-label !mb-0">Rejection Rate</span>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl font-mono font-bold text-destructive">{selectedFarmer.rejectionRate}%</span>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-destructive" style={{ width: `${selectedFarmer.rejectionRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Scan Log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="data-label !mb-0">Scan Log ({farmerScans.length} batches)</p>
                  <button
                    onClick={() => setShowLog(v => !v)}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-3 py-1 hover:bg-primary/10 transition-colors"
                  >
                    {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showLog ? "Hide Log" : "View Log"}
                  </button>
                </div>

                {/* Latest batch summary — always visible */}
                <div className="border border-border">
                  <div className="p-4 flex items-center justify-between bg-secondary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground font-medium">{selectedFarmer.recentActivity}</p>
                        <p className="text-xs text-muted-foreground">
                          {farmerScans[0]?.tx_hash ? "✅ Blockchain anchored" : "⏳ Pending blockchain anchor"}
                        </p>
                      </div>
                    </div>
                    {farmerScans[0]?.tx_hash && (
                      <a
                        href={buildBlockchainTxUrl(farmerScans[0].tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-3 py-1 hover:bg-primary/10 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> TX
                      </a>
                    )}
                  </div>

                  {/* Expandable log table */}
                  <AnimatePresence>
                    {showLog && farmerScans.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-secondary/30 border-b border-border">
                                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Batch ID</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Date</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Grade</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal text-center">Chain</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal text-right">TX</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {farmerScans.map((scan) => {
                                const info = getGradeInfo(scan.overall_grade);
                                return (
                                  <tr key={scan.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="p-3 font-mono text-xs font-bold text-foreground">{scan.batch_id}</td>
                                    <td className="p-3 text-xs text-muted-foreground">{new Date(scan.created_at).toLocaleDateString()}</td>
                                    <td className="p-3">
                                      <span className={`font-mono text-xs font-bold ${info.textClass}`}>{scan.overall_grade}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`inline-block w-2 h-2 rounded-full ${
                                        scan.tx_hash ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-orange-500 animate-pulse"
                                      }`} />
                                    </td>
                                    <td className="p-3 text-right">
                                      {scan.tx_hash ? (
                                        <a
                                          href={buildBlockchainTxUrl(scan.tx_hash)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          {scan.tx_hash.slice(0, 8)}…
                                        </a>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground/50">Pending</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <User className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium text-foreground">Select a farmer profile</p>
              <p className="text-sm mt-1 max-w-[250px]">Search for a farmer by their exact name or ID to view their grading history and statistics.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
