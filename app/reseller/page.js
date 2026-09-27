"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { ToastArea, useToast } from "../components/Toast";
import KeyTable from "../components/KeyTable";
import DeviceModal from "../components/DeviceModal";
import CreateKeyPanel from "../components/CreateKeyPanel";
import ThemeToggle from "../components/ThemeToggle";

export default function Reseller() {
  const [token, setToken]       = useState("");
  const [username, setUsername] = useState("");
  const [tab, setTab]           = useState("keys");
  const [keys, setKeys]         = useState([]);
  const [balance, setBalance]   = useState(0);
  const [deviceModal, setDeviceModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [banned, setBanned]     = useState(false);
  const { toasts, push }        = useToast();
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("ffex_token");
    const r = localStorage.getItem("ffex_role");
    const u = localStorage.getItem("ffex_username");
    if (!t || r !== "reseller") { router.replace("/login"); return; }
    setToken(t); setUsername(u || "reseller");
  }, [router]);

  useEffect(() => { if (token) load(); }, [token]);

  async function api(path, opts={}) {
    const r = await fetch(path, {
      ...opts,
      headers: { ...(opts.headers||{}), Authorization:`Bearer ${token}`, "content-type":"application/json" },
    });
    const d = await r.json();
    if (r.status === 401) { router.replace("/login"); throw new Error("Session expired"); }
    if (r.status === 403 && d.banned) { setBanned(true); return null; }
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  }

  async function load() {
    try {
      const d = await api("/api/licenses");
      if (!d) return;
      setKeys(d.licenses || []);
      setBalance(d.credit_balance ?? 0);
    } catch(e) { push(e.message,"err"); }
  }

  async function keyAction(key, action) {
    try {
      const d = await api("/api/licenses", { method:"PATCH", body:JSON.stringify({ key, action }) });
      if (action==="reset_hwid") push(d.message||"HWID reset","ok");
      else push(`Key ${action}d`,"ok");
      load();
    } catch(e) { push(e.message,"err"); }
  }

  async function openDevices(key) {
    try { setDeviceModal({ key, ...(await api(`/api/licenses/devices?key=${encodeURIComponent(key)}`)) }); }
    catch(e) { push(e.message,"err"); }
  }

  if (banned) {
    return (
      <div className="ban-notice">
        <div className="ban-card">
          <div className="ban-icon">🚫</div>
          <div className="ban-title">Account Banned</div>
          <p className="ban-text">YOUR ACCOUNT HAS BEEN BANNED FOR VIOLATING TERMS OF SERVICE</p>
          <button className="btn btn-danger" style={{ width:"100%", padding:"12px" }}
            onClick={()=>{localStorage.removeItem("ffex_token");localStorage.removeItem("ffex_role");router.replace("/login");}}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const active  = keys.filter(x=>x.status==="active").length;
  const unused  = keys.filter(x=>x.status==="unused").length;
  const expired = keys.filter(x=>x.status==="expired").length;
  const TITLES  = { keys:"My Keys", create:"Create Key" };

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={()=>setSidebarOpen(o=>!o)}>
        <span/><span/><span/>
      </button>

      <Sidebar role="reseller" activeTab={tab} onTabChange={t=>{ setTab(t); if(t==="keys"||t==="create") load(); }}
        username={username} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">{TITLES[tab]||tab}</div>
          <div className="topbar-actions">
            <div style={{ fontSize:14, fontWeight:800, color:"var(--ios-blue)" }}>{balance} cr</div>
            <button className="btn btn-sm" onClick={load}>↻</button>
            <ThemeToggle />
          </div>
        </header>

        <main className="page-content">

          {tab==="keys" && (
            <div>
              <div className="stats-row" style={{ marginBottom:20 }}>
                <div className="stat-card"><div className="stat-label">Credit</div><div className="stat-value blue">{balance}</div></div>
                <div className="stat-card"><div className="stat-label">Total Keys</div><div className="stat-value">{keys.length}</div></div>
                <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value green">{active}</div></div>
                <div className="stat-card"><div className="stat-label">Unused</div><div className="stat-value">{unused}</div></div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-title">My License Keys</div><div className="card-sub">All keys under this account</div></div>
                </div>
                <KeyTable rows={keys} onAction={keyAction} onDevices={openDevices} />
              </div>
            </div>
          )}

          {tab==="create" && (
            <div className="grid-12">
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Generate Keys</div></div>
                  <CreateKeyPanel role="reseller" balance={balance} token={token}
                    onCreated={(newKeys,newBal)=>{ if(newBal!==undefined) setBalance(newBal); load(); }}
                    push={push} />
                </div>
              </div>
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Price Table</div></div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--label-tertiary)", marginBottom:10 }}>FFEX Lite</div>
                  {[["1h","0.1 cr"],["1d","2 cr"],["7d","8 cr"],["30d","15 cr"]].map(([d,c])=>(
                    <div key={d} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--separator)", fontSize:14 }}>
                      <span style={{ color:"var(--label-tertiary)", fontWeight:500 }}>{d}</span>
                      <span style={{ fontWeight:800, color:"var(--label-primary)" }}>{c}</span>
                    </div>
                  ))}
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--label-tertiary)", margin:"14px 0 10px" }}>FFEX Pro</div>
                  {[["1h","0.3 cr"],["1d","4 cr"],["7d","15 cr"],["30d","30 cr"]].map(([d,c])=>(
                    <div key={d} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid var(--separator)", fontSize:14 }}>
                      <span style={{ color:"var(--label-tertiary)", fontWeight:500 }}>{d}</span>
                      <span style={{ fontWeight:800, color:"var(--ios-blue)" }}>{c}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:16, padding:"12px 14px", background:"var(--bg-primary)", borderRadius:"var(--radius-sm)", fontSize:13, color:"var(--label-tertiary)", fontWeight:500 }}>
                    VIP keys — HWID locked on first login. Reset available in key list.
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      <DeviceModal data={deviceModal} onClose={()=>setDeviceModal(null)} />
      <ToastArea toasts={toasts} />
    </div>
  );
}
