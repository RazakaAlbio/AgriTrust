import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, CreditCard, Server, Wifi, WifiOff, Loader2, CheckCircle2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"register" | "rfid" | "devices">("register");
  
  // Register Form State
  const [form, setForm] = useState({ name: "", rfid_tag: "", location: "", group_class: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Data State
  const [devices, setDevices] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tabs = [
    { id: "register" as const, label: "Register", icon: UserPlus },
    { id: "rfid" as const, label: "RFID Mgmt", icon: CreditCard },
    { id: "devices" as const, label: "Devices", icon: Server },
  ];

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [devRes, farmRes] = await Promise.all([
        supabase.from('devices').select('*'),
        supabase.from('farmers').select('*')
      ]);
      
      if (devRes.data) setDevices(devRes.data);
      if (farmRes.data) setFarmers(farmRes.data);
      
      setIsLoading(false);
    }
    
    fetchData();
  }, [activeTab]); // Refetch when changing tabs

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg("");
    
    const { error } = await supabase.from('farmers').insert([form]);
    
    setIsSubmitting(false);
    if (!error) {
      setSuccessMsg("Farmer registered successfully!");
      setForm({ name: "", rfid_tag: "", location: "", group_class: "" });
      setTimeout(() => setSuccessMsg(""), 3000);
      
      // Refresh list
      const { data } = await supabase.from('farmers').select('*');
      if (data) setFarmers(data);
    } else {
      console.error(error);
      alert("Failed to register farmer.");
    }
  };

  const handleDeleteFarmer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this farmer? This action cannot be undone.")) return;
    
    const { error } = await supabase.from('farmers').delete().eq('id', id);
    if (!error) {
      setFarmers(farmers.filter(f => f.id !== id));
    } else {
      alert("Failed to delete farmer.");
    }
  };

  const handleRevokeRfid = async (id: string) => {
    if (!confirm("Revoke this RFID tag? The farmer will not be able to scan.")) return;

    const { error } = await supabase.from('farmers').update({ rfid_tag: null }).eq('id', id);
    if (!error) {
      setFarmers(farmers.map(f => f.id === id ? { ...f, rfid_tag: null } : f));
    } else {
      alert("Failed to revoke RFID.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-tighter text-foreground">
            ADMIN_PANEL
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            System Management · Protected Access
          </p>
        </div>
        <button 
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/");
          }}
          className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-sm font-mono"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
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
        <div className="border border-t-0 border-border bg-background p-6">
          {activeTab === "register" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">Register Farmer</h2>
                <p className="text-xs text-muted-foreground">Add a new farmer and link their RFID tag.</p>
              </div>

              {successMsg && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4 max-w-md">
                <div>
                  <label className="data-label block mb-1.5">Full Name</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                </div>
                <div>
                  <label className="data-label block mb-1.5">RFID Tag (Hex)</label>
                  <input type="text" value={form.rfid_tag} onChange={e => setForm({...form, rfid_tag: e.target.value})} required placeholder="e.g. 0x4A:2F:8C:D1" className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground uppercase" />
                </div>
                <div>
                  <label className="data-label block mb-1.5">Location</label>
                  <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required placeholder="e.g. Bandung, West Java" className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                </div>
                <div>
                  <label className="data-label block mb-1.5">Group / Class</label>
                  <input type="text" value={form.group_class} onChange={e => setForm({...form, group_class: e.target.value})} className="w-full bg-secondary/50 border border-border p-2.5 font-mono text-sm focus:outline-none focus:border-primary text-foreground" />
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-rugged w-full mt-4 flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Profile"}
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === "rfid" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">RFID Database</h2>
                <p className="text-xs text-muted-foreground">Manage linked hardware tokens.</p>
              </div>

              {isLoading ? (
                <div className="text-sm text-muted-foreground animate-pulse">Loading farmers...</div>
              ) : (
                <div className="border border-border">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-secondary/30 border-b border-border">
                        <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">RFID HEX</th>
                        <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Linked User</th>
                        <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
                        <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {farmers.map((farmer, i) => (
                        <tr key={i} className="hover:bg-secondary/10">
                          <td className="p-3 font-mono text-sm text-primary">{farmer.rfid_tag || "UNASSIGNED"}</td>
                          <td className="p-3 text-sm text-foreground">{farmer.name}</td>
                          <td className="p-3">
                            {farmer.rfid_tag ? (
                              <span className="text-[10px] uppercase tracking-widest font-bold text-green-500 border border-green-500/30 bg-green-500/10 px-2 py-0.5">Linked</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest font-bold text-orange-500 border border-orange-500/30 bg-orange-500/10 px-2 py-0.5">No Tag</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {farmer.rfid_tag && (
                              <button onClick={() => handleRevokeRfid(farmer.id)} className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-orange-500 border border-border hover:border-orange-500/50 px-2 py-1 transition-colors">
                                Revoke
                              </button>
                            )}
                            <button onClick={() => handleDeleteFarmer(farmer.id)} className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-destructive border border-border hover:border-destructive/50 px-2 py-1 transition-colors">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "devices" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">Edge Devices</h2>
                <p className="text-xs text-muted-foreground">Real-time status of compute nodes.</p>
              </div>

              {isLoading ? (
                <div className="text-sm text-muted-foreground animate-pulse">Loading devices...</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {devices.map((dev, i) => {
                    const isOnline = dev.status === "online";
                    return (
                      <div key={i} className={`border p-4 ${isOnline ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/20"}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {isOnline ? <Wifi className="w-4 h-4 text-primary" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
                            <span className="font-mono text-sm font-bold text-foreground">{dev.device_name}</span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 border ${
                            isOnline ? "text-primary border-primary/30" : "text-muted-foreground border-border"
                          }`}>
                            {dev.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Type</span>
                            <span className="font-mono text-foreground uppercase">{dev.device_type}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Last Ping</span>
                            <span className="font-mono text-foreground">{dev.last_ping ? new Date(dev.last_ping).toLocaleTimeString() : 'Never'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {devices.length === 0 && (
                    <div className="col-span-2 p-8 text-center border border-dashed border-border text-muted-foreground text-sm">
                      No devices connected.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
