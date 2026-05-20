import { motion } from "framer-motion";
import { Activity, ShieldCheck, TrendingDown, Clock, AlertTriangle, Info, CheckCircle2, Server, Globe, Database, Network } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend, AreaChart, Area } from "recharts";

const KPI = [
  { label: "Active Farmers", value: "24",     icon: Activity },
  { label: "Total Scanned",  value: "1,247",  icon: Database },
  { label: "Grade A Rate",   value: "68.2%",  icon: ShieldCheck, accent: true },
  { label: "Reject Rate",    value: "5.8%",   icon: TrendingDown, warning: true },
];

const SYSTEM_HEALTH = [
  { label: "Edge-AI Nodes", status: "Operational", ping: "12ms", icon: Server },
  { label: "Blockchain Sync", status: "Synced", ping: "45ms", icon: Network },
  { label: "Cloud Database", status: "Online", ping: "22ms", icon: Globe },
];

const CHART_DATA = [
  { day: "Mon", gradeA: 14, gradeB: 5, gradeC: 3, reject: 1 },
  { day: "Tue", gradeA: 18, gradeB: 4, gradeC: 2, reject: 2 },
  { day: "Wed", gradeA: 12, gradeB: 6, gradeC: 4, reject: 3 },
  { day: "Thu", gradeA: 20, gradeB: 3, gradeC: 2, reject: 1 },
  { day: "Fri", gradeA: 16, gradeB: 5, gradeC: 3, reject: 2 },
  { day: "Sat", gradeA: 22, gradeB: 4, gradeC: 1, reject: 0 },
  { day: "Sun", gradeA: 15, gradeB: 6, gradeC: 3, reject: 1 },
];

const YIELD_DATA = [
  { time: "08:00", volume: 120 },
  { time: "10:00", volume: 210 },
  { time: "12:00", volume: 180 },
  { time: "14:00", volume: 340 },
  { time: "16:00", volume: 290 },
  { time: "18:00", volume: 150 },
];

const COLORS = {
  gradeA: "hsl(142 71% 45%)",
  gradeB: "hsl(45 93% 47%)",
  gradeC: "hsl(25 95% 53%)",
  reject: "hsl(0 72% 51%)",
};

const stagger = {
  hidden: { opacity: 0, scale: 0.98 },
  show: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const },
  }),
};

export default function OverviewTab() {
  return (
    <div className="space-y-4">
      
      {/* ── Why Agri-Trust Banner ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="border border-border bg-secondary/20 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tighter text-foreground">Why Agri-Trust?</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Agri-Trust bridges the gap between farmers and consumers using Decentralized Edge-AI. By grading produce directly at the source using YOLOv8 computer vision and logging the results immutably on the Polygon blockchain, we eliminate fraud, ensure fair pricing for farmers, and guarantee 100% transparency for buyers.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Edge-AI Grading
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" /> IoT Sensor Fusion
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Blockchain Integrity
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* ── Left Column: KPIs & Charts ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI Cards */}
          <motion.div initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 border border-border">
            {KPI.map((kpi, i) => (
              <motion.div key={kpi.label} custom={i} variants={stagger}
                className={`p-4 border-r border-b lg:border-b-0 border-border last:border-r-0 flex flex-col gap-2 ${kpi.accent ? "bg-primary/5" : ""} ${kpi.warning ? "bg-destructive/5" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="data-label !mb-0">{kpi.label}</p>
                  <kpi.icon className={`w-4 h-4 ${kpi.warning ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
                <p className={`font-mono text-3xl font-bold tracking-tighter ${
                  kpi.accent ? "text-primary" : kpi.warning ? "text-destructive" : "text-foreground"
                }`}>{kpi.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Grade Distribution */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="border border-border">
              <div className="border-b border-border p-3 flex items-center justify-between bg-secondary/30">
                <p className="data-label !mb-0">Grade Distribution</p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Last 7 Days</p>
              </div>
              <div className="p-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CHART_DATA} barSize={12}>
                    <CartesianGrid stroke="hsl(0 0% 15%)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "hsl(0 0% 60%)", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "hsl(0 0% 20%)" }} tickLine={false} />
                    <Tooltip cursor={{ fill: 'hsl(0 0% 15%)' }} contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 0, fontFamily: "monospace", fontSize: 11 }} />
                    <Bar dataKey="gradeA" stackId="a" fill={COLORS.gradeA} />
                    <Bar dataKey="gradeB" stackId="a" fill={COLORS.gradeB} />
                    <Bar dataKey="gradeC" stackId="a" fill={COLORS.gradeC} />
                    <Bar dataKey="reject" stackId="a" fill={COLORS.reject} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Daily Volume */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="border border-border">
              <div className="border-b border-border p-3 flex items-center justify-between bg-secondary/30">
                <p className="data-label !mb-0">Throughput Volume</p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Today</p>
              </div>
              <div className="p-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={YIELD_DATA}>
                    <defs>
                      <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(0 0% 15%)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "hsl(0 0% 60%)", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "hsl(0 0% 20%)" }} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 0, fontFamily: "monospace", fontSize: 11 }} />
                    <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVol)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Right Column: Health & Alerts ── */}
        <div className="space-y-4">
          {/* System Health */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="border border-border">
            <div className="border-b border-border p-3 bg-secondary/30">
              <p className="data-label !mb-0">System Health</p>
            </div>
            <div className="divide-y divide-border">
              {SYSTEM_HEALTH.map((sys) => (
                <div key={sys.label} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <sys.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{sys.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot-synced" />
                    <span className="text-xs font-mono text-muted-foreground">{sys.ping}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Alerts */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="border border-border">
            <div className="border-b border-border p-3 flex items-center justify-between bg-destructive/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                <p className="data-label !mb-0 text-destructive">Recent Alerts</p>
              </div>
              <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-sm font-bold">2 NEW</span>
            </div>
            <div className="divide-y divide-border">
              <div className="p-3 bg-destructive/5 hover:bg-secondary transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-destructive uppercase tracking-widest">Critical Rejection</span>
                  <span className="text-[10px] text-muted-foreground font-mono">10m ago</span>
                </div>
                <p className="text-sm text-foreground">Batch B-0846 flagged for severe molding.</p>
              </div>
              <div className="p-3 bg-destructive/5 hover:bg-secondary transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Sensor Warning</span>
                  <span className="text-[10px] text-muted-foreground font-mono">1h ago</span>
                </div>
                <p className="text-sm text-foreground">High VOC levels detected at Node 02.</p>
              </div>
              <div className="p-3 hover:bg-secondary transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sync Delayed</span>
                  <span className="text-[10px] text-muted-foreground font-mono">3h ago</span>
                </div>
                <p className="text-sm text-muted-foreground">Blockchain RPC timeout, retried successfully.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
