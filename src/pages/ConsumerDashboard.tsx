import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Search, History, Users, ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import OverviewTab from "@/components/dashboard/OverviewTab";
import VerifyTab from "@/components/dashboard/VerifyTab";
import HistoryTab from "@/components/dashboard/HistoryTab";
import FarmersTab from "@/components/dashboard/FarmersTab";
import CustomerTracker from "./CustomerTracker";

type Tab = "overview" | "verify" | "history" | "farmers" | "track_dispute";

const BASE_TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview",      label: "Overview",      icon: BarChart3 },
  { id: "verify",        label: "Verify",        icon: Search },
  { id: "history",       label: "History",       icon: History },
  { id: "farmers",       label: "Farmers",       icon: Users },
  { id: "track_dispute", label: "Track Dispute", icon: AlertTriangle },
];

export default function ConsumerDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  const TABS = BASE_TABS;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
                CONSUMER_<span className="text-primary">DASHBOARD</span>
              </h1>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Verify Batches · Track Disputes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="status-dot status-dot-synced" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">System Online</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex flex-wrap sm:flex-nowrap border border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[50%] sm:min-w-0 flex items-center justify-center gap-2 p-3 text-[10px] uppercase tracking-widest font-bold transition-colors border-r border-b sm:border-b-0 border-border last:border-r-0 ${
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
      <div className="max-w-6xl mx-auto p-4 pt-0 mt-4">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 1, 0.3, 1] }}
        >
          {tab === "overview"       && <OverviewTab />}
          {tab === "verify"         && <VerifyTab />}
          {tab === "history"        && <HistoryTab />}
          {tab === "farmers"        && <FarmersTab />}
          {tab === "track_dispute"  && <CustomerTracker />}
        </motion.div>
      </div>
    </div>
  );
}
