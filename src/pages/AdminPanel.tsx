import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, CreditCard, Server, Wifi, WifiOff, Loader2 } from "lucide-react";

const DEVICES = [
  { name: "JETSON_NANO_01", status: "ONLINE", ping: "12ms", type: "primary" },
  { name: "ESP32_NODE_01", status: "ONLINE", ping: "8ms", type: "sensor" },
  { name: "ESP32_NODE_02", status: "SYNCING", ping: "—", type: "sensor" },
  { name: "ESP32_NODE_03", status: "ONLINE", ping: "15ms", type: "sensor" },
  { name: "ESP32_NODE_04", status: "OFFLINE", ping: "—", type: "sensor" },
];

const RFID_LINKS = [
  { hex: "0x4A:2F:8C:D1", user: "Ahmad Rizal", linked: true },
  { hex: "0x7B:3E:9A:F2", user: "Siti Nurhaliza", linked: true },
  { hex: "0x1C:5D:4E:B3", user: "—", linked: false },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"register" | "rfid" | "devices">("register");
  const [form, setForm] = useState({ name: "", nim: "", group: "", role: "farmer" });

  const tabs = [
    { id: "register" as const, label: "Register", icon: UserPlus },
    { id: "rfid" as const, label: "RFID Mgmt", icon: CreditCard },
    { id: "devices" as const, label: "Devices", icon: Server },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
          ADMIN_PANEL
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
          System Management · Protected Access
        </p>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-0">
        {/* Tab Bar */}
        <div className="flex border border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] uppercase tracking-widest font-bold transition-colors border-r border-border last:border-r-0 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.2, 1, 0.3, 1] }}
          className="border border-border border-t-0"
        >
          {activeTab === "register" && (
            <div className="p-6 space-y-4">
              <p className="data-label">Register New Farmer</p>
              {[
                { label: "Full Name", key: "name", placeholder: "e.g. Ahmad Rizal" },
                { label: "NIM / ID Number", key: "nim", placeholder: "e.g. 2024001" },
                { label: "Class / Group", key: "group", placeholder: "e.g. Group A" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="data-label block mb-1.5">{field.label}</label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full bg-background border border-border p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="data-label block mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-background border border-border p-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="farmer">Farmer</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="btn-rugged w-full mt-2">
                Register User
              </button>
            </div>
          )}

          {activeTab === "rfid" && (
            <div>
              <div className="p-4 border-b border-border">
                <p className="data-label !mb-0">RFID Tag Assignment</p>
              </div>
              {/* Scan zone */}
              <div className="p-6 border-b border-border flex flex-col items-center justify-center gap-3">
                <div className="relative w-40 h-24 border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                  <CreditCard className="w-10 h-10 text-muted-foreground" />
                  <div className="absolute left-0 right-0 h-0.5 bg-primary animate-scan-line" />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
                  Awaiting RFID Tag...
                </p>
              </div>
              {/* Linked tags */}
              {RFID_LINKS.map((link) => (
                <div key={link.hex} className="p-4 border-b border-border last:border-b-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-3">
                    <CreditCard className={`w-4 h-4 ${link.linked ? "text-success" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-mono text-sm font-bold text-foreground">{link.hex}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {link.linked ? link.user : "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${
                    link.linked ? "text-success" : "text-primary"
                  }`}>
                    {link.linked ? "Linked" : "Assign"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "devices" && (
            <div>
              <div className="p-4 border-b border-border">
                <p className="data-label !mb-0">Device Network Status</p>
              </div>
              <div className="bg-background font-mono text-sm">
                {DEVICES.map((device) => (
                  <div key={device.name} className="p-4 border-b border-border last:border-b-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-3">
                      {device.status === "ONLINE" && <Wifi className="w-4 h-4 text-success" />}
                      {device.status === "SYNCING" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                      {device.status === "OFFLINE" && <WifiOff className="w-4 h-4 text-destructive" />}
                      <span className="text-foreground font-bold">{device.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        device.status === "ONLINE" ? "text-success" :
                        device.status === "SYNCING" ? "text-primary" :
                        "text-destructive"
                      }`}>
                        {device.status}
                      </span>
                      {device.ping !== "—" && (
                        <span className="text-muted-foreground text-xs">
                          Ping: {device.ping}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
