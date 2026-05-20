import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Package, ShieldAlert, Star, MapPin, Calendar } from "lucide-react";

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

const MOCK_FARMERS: FarmerProfile[] = [
  { id: "F-001", name: "Ahmad Rizal", location: "Bandung, West Java", joinedDate: "2023-01-15", totalBatches: 142, averageGrade: "Grade A", rejectionRate: 2.1, recentActivity: "Submitted 1 batch 2 hours ago" },
  { id: "F-002", name: "Siti Nurhaliza", location: "Lembang, West Java", joinedDate: "2023-03-22", totalBatches: 87, averageGrade: "Grade B", rejectionRate: 5.4, recentActivity: "Submitted 2 batches yesterday" },
  { id: "F-003", name: "Budi Santoso", location: "Malang, East Java", joinedDate: "2022-11-05", totalBatches: 315, averageGrade: "Grade A", rejectionRate: 1.2, recentActivity: "Submitted 5 batches 3 days ago" },
  { id: "F-004", name: "Dewi Lestari", location: "Garut, West Java", joinedDate: "2024-02-10", totalBatches: 24, averageGrade: "Grade C", rejectionRate: 12.5, recentActivity: "Submitted 1 batch last week" },
  { id: "F-005", name: "Agus Prasetyo", location: "Kediri, East Java", joinedDate: "2023-08-19", totalBatches: 56, averageGrade: "Grade B", rejectionRate: 4.8, recentActivity: "Submitted 3 batches yesterday" },
];

export default function FarmersTab() {
  const [query, setQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerProfile | null>(null);

  const filteredFarmers = MOCK_FARMERS.filter(f => 
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
              onClick={() => setSelectedFarmer(farmer)}
              className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-secondary/50 ${
                selectedFarmer?.id === farmer.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-foreground">{farmer.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{farmer.id}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                      <p className="font-mono text-xs text-primary">{selectedFarmer.id}</p>
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
                    "text-orange-400"
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

              {/* Recent Activity */}
              <div>
                <p className="data-label mb-3">Recent Activity</p>
                <div className="border border-border divide-y divide-border">
                  <div className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground font-medium">{selectedFarmer.recentActivity}</p>
                        <p className="text-xs text-muted-foreground">Blockchain verified</p>
                      </div>
                    </div>
                    <button className="text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-3 py-1 hover:bg-primary/10 transition-colors">
                      View Log
                    </button>
                  </div>
                  {/* Mock additional historical rows */}
                  <div className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground font-medium">Submitted 4 batches</p>
                        <p className="text-xs text-muted-foreground">1 week ago</p>
                      </div>
                    </div>
                  </div>
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
