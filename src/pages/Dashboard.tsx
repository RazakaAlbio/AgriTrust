import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Search, History, QrCode } from "lucide-react";
import OverviewTab from "@/components/dashboard/OverviewTab";
import VerifyTab from "@/components/dashboard/VerifyTab";
import HistoryTab from "@/components/dashboard/HistoryTab";
import QRGenerator from "@/components/QRGenerator";

type Tab = "overview" | "verify" | "history";

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "verify",   label: "Verify",   icon: Search },
  { id: "history",  label: "History",  icon: History },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
              AGRI<span className="text-primary">_</span>TRUST
            </h1>
            <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 border border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
              DEMO
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Unified Dashboard · Edge-AI Grading Hub
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

      {/* Tab Bar */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex border border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] uppercase tracking-widest font-bold transition-colors border-r border-border last:border-r-0 ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto p-4 pt-0">
        <motion.div
          key={tab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.2, 1, 0.3, 1] }}
        >
          {tab === "overview" && <OverviewTab />}
          {tab === "verify" && <VerifyTab />}
          {tab === "history" && <HistoryTab />}
        </motion.div>

        {showQR && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4"
          >
            <QRGenerator />
          </motion.div>
        )}
      </div>
    </div>
  );
}
