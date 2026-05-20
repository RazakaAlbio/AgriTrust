import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Settings, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  {
    to: "/dashboard",
    icon: BarChart3,
    title: "DASHBOARD",
    desc: "Overview, verify products, scan history & farmer search",
  },
  {
    to: "/admin",
    icon: Settings,
    title: "ADMIN_PANEL",
    desc: "Register users, manage RFID tags, monitor device network",
  },
];

const stagger = {
  hidden: { opacity: 0, x: -10 },
  show: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: 0.2 + i * 0.1, duration: 0.4, ease: [0.2, 1, 0.3, 1] as const },
  }),
};

export default function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 1, 0.3, 1] }}
        className="w-full max-w-md border border-border"
      >
        <div className="border-b border-border p-6">
          <h1 className="font-mono text-2xl font-bold tracking-tighter text-foreground">
            AGRI<span className="text-primary">_</span>TRUST
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Decentralized Edge-AI Grading Hub
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            YOLOv8n · 7 Classes · 78.0% mAP@50 · Polygon Amoy
          </p>
        </div>

        <motion.div initial="hidden" animate="show">
          {NAV_ITEMS.map((item, i) => (
            <motion.div key={item.to} custom={i} variants={stagger}>
              <Link to={item.to}
                className="flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors group">
                <item.icon className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold tracking-tighter text-foreground">{item.title}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5 truncate">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="border-t border-border p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Batch Verified · 100% Integrity
          </p>
        </div>
      </motion.div>
    </div>
  );
}
