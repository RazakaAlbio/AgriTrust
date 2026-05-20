import { motion } from "framer-motion";
import { Activity, ShieldCheck, TrendingDown, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend } from "recharts";

const KPI = [
  { label: "Total Scanned", value: "1,247", icon: Activity },
  { label: "Grade A Rate",  value: "68.2%", icon: ShieldCheck, accent: true },
  { label: "Reject Rate",   value: "5.8%",  icon: TrendingDown },
  { label: "Pending Sync",  value: "3",     icon: Clock, warning: true },
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
    <div className="space-y-0">
      {/* KPI Cards */}
      <motion.div initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 border border-border border-t-0">
        {KPI.map((kpi, i) => (
          <motion.div key={kpi.label} custom={i} variants={stagger}
            className={`data-cell flex flex-col gap-2 ${kpi.accent ? "border-l-2 border-l-primary" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="data-label">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.warning ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
            <p className={`font-mono text-3xl font-bold tracking-tighter ${
              kpi.accent ? "text-primary" : kpi.warning ? "text-amber-400" : "text-foreground"
            }`}>{kpi.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }} className="border border-border border-t-0">
        <div className="border-b border-border p-3 flex items-center justify-between">
          <p className="data-label !mb-0">Grade Distribution · Last 7 Days</p>
          <p className="text-[10px] uppercase tracking-widest text-primary">Stacked</p>
        </div>
        <div className="p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CHART_DATA} barSize={14}>
              <CartesianGrid stroke="hsl(0 0% 20%)" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(0 0% 60%)", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "hsl(0 0% 20%)" }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(0 0% 60%)", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "hsl(0 0% 20%)" }} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 0, fontFamily: "monospace", fontSize: 11 }} />
              <Legend formatter={(v: string) => ({ gradeA: "Grade A", gradeB: "Grade B", gradeC: "Grade C", reject: "Reject" }[v] ?? v)}
                wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
              <Bar dataKey="gradeA" stackId="a" fill={COLORS.gradeA} />
              <Bar dataKey="gradeB" stackId="a" fill={COLORS.gradeB} />
              <Bar dataKey="gradeC" stackId="a" fill={COLORS.gradeC} />
              <Bar dataKey="reject" stackId="a" fill={COLORS.reject} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
