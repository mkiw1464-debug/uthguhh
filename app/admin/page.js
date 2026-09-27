"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { ToastArea, useToast } from "../components/Toast";
import KeyTable from "../components/KeyTable";
import DeviceModal from "../components/DeviceModal";
import CreateKeyPanel from "../components/CreateKeyPanel";
import ThemeToggle from "../components/ThemeToggle";

export default function Admin() {
  const [token, setToken]       = useState("");
  const [username, setUsername] = useState("");
  const [tab, setTab]           = useState("keys");
  const [keys, setKeys]         = useState([]);
  const [balance, setBalance]   = useState(0);
  const [resellers, setResellers] = useState([]);
  const [resellerDetail, setResellerDetail] = useState(null);
  const [deviceModal, setDeviceModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newRes, setNewRes]     = useState({ username:"", password:"" });
  const [banned, setBanned]     = useState(false);
  const { toasts, push }        = useToast();
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("ffex_token");
    const r = localStorage.getItem("ffex_role");
    const u = localStorage.getItem("ffex_username");
    if (!t || r !== "admin") { router.replace("/login"); return; }
    setToken(t); setUsername(u || "admin");
  }, [router]);

  useEffect(() => { if (token) loadKeys(); }, [token]);

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

  async function loadKeys() {
    try {
      const d = await api("/api/licenses");
      if (!d) return;
      setKeys(d.licenses || []);
      setBalance(d.credit_balance ?? 0);
    } catch(e) { push(e.message,"err"); }
  }

  async function loadResellers() {
    try { setResellers((await api("/api/resellers"))?.resellers || []); }
    catch(e) { push(e.message,"err"); }
  }

  async function openResellerDetail(id) {
    try { setResellerDetail(await api(`/api/resellers?id=${id}`)); }
    catch(e) { push(e.message,"err"); }
  }

  function changeTab(t) {
    setTab(t);
    setResellerDetail(null);
    if (t==="keys"||t==="create") loadKeys();
    if (t==="resellers"||t==="manage-resellers") loadResellers();
  }

  async function keyAction(key, action) {
    try {
      const d = await api("/api/licenses", { method:"PATCH", body:JSON.stringify({ key, action }) });
      if (action==="reset_hwid") push(d.message||"HWID reset","ok");
      else push(`Key ${action}d`,"ok");
      loadKeys();
      if (resellerDetail) openResellerDetail(resellerDetail.reseller.id);
    } catch(e) { push(e.message,"err"); }
  }

  async function openDevices(key) {
    try { setDeviceModal({ key, ...(await api(`/api/licenses/devices?key=${encodeURIComponent(key)}`)) }); }
    catch(e) { push(e.message,"err"); }
  }

  async function createReseller() {
    if (!newRes.username||!newRes.password) { push("Fill all fields","err"); return; }
    try {
      await api("/api/resellers", { method:"POST", body:JSON.stringify(newRes) });
      push("Reseller created","ok");
      setNewRes({ username:"", password:"" });
      loadResellers();
    } catch(e) { push(e.message,"err"); }
  }

  async function addCredit(id, name) {
    const raw = prompt(`Add credit to ${name}:`, "100");
    if (raw===null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount)||amount<=0) { push("Enter valid amount","err"); return; }
    try {
      const d = await api("/api/resellers", { method:"PATCH", body:JSON.stringify({ id, amount }) });
      push(`Added ${amount} cr to ${name}. Balance: ${d.credit_balance}`,"ok");
      loadResellers();
      if (resellerDetail) openResellerDetail(id);
    } catch(e) { push(e.message,"err"); }
  }

  async function banReseller(id, name) {
    if (!confirm(`Ban reseller ${name}?`)) return;
    try {
      await api("/api/resellers", { method:"PATCH", body:JSON.stringify({ id, action:"ban" }) });
      push(`Reseller ${name} banned`,"ok");
      loadResellers();
    } catch(e) { push(e.message,"err"); }
  }

  async function deleteReseller(id, name) {
    if (!confirm(`Delete reseller ${name}?`)) return;
    try {
      await api("/api/resellers", { method:"PATCH", body:JSON.stringify({ id, action:"delete" }) });
      push("Reseller deleted","ok");
      setResellerDetail(null); loadResellers();
    } catch(e) { push(e.message,"err"); }
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

  const active = keys.filter(x=>x.status==="active").length;
  const unused = keys.filter(x=>x.status==="unused").length;
  const TITLES = { keys:"My Keys", create:"Create Key", resellers:"Create Reseller", "manage-resellers":"Manage Resellers" };

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={()=>setSidebarOpen(o=>!o)}>
        <span/><span/><span/>
      </button>

      <Sidebar role="admin" activeTab={tab} onTabChange={changeTab} username={username}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">{TITLES[tab]||tab}</div>
          <div className="topbar-actions">
            <div style={{ fontSize:14, fontWeight:800, color:"var(--ios-blue)" }}>{balance} cr</div>
            <button className="btn btn-sm" onClick={()=>changeTab(tab)}>↻</button>
            <ThemeToggle />
          </div>
        </header>

        <main className="page-content">

          {tab==="keys" && (
            <div>
              <div className="stats-row" style={{ marginBottom:20 }}>
                <div className="stat-card"><div className="stat-label">Total Keys</div><div className="stat-value">{keys.length}</div></div>
                <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value green">{active}</div></div>
                <div className="stat-card"><div className="stat-label">Unused</div><div className="stat-value">{unused}</div></div>
                <div className="stat-card"><div className="stat-label">Credit</div><div className="stat-value blue">{balance}</div></div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-title">My License Keys</div><div className="card-sub">Keys you created</div></div>
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
                  <CreateKeyPanel role="admin" balance={balance} token={token}
                    onCreated={(newKeys,newBal)=>{ if(newBal!==undefined) setBalance(newBal); loadKeys(); }}
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
                </div>
              </div>
            </div>
          )}

          {tab==="resellers" && (
            <div className="grid-12">
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Create Reseller</div></div>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <div>
                      <label className="field-label">Username</label>
                      <input className="input" value={newRes.username}
                        onChange={e=>setNewRes(p=>({...p,username:e.target.value}))} placeholder="reseller_name" />
                    </div>
                    <div>
                      <label className="field-label">Password</label>
                      <input className="input" type="password" value={newRes.password}
                        onChange={e=>setNewRes(p=>({...p,password:e.target.value}))} placeholder="min 4 chars" />
                    </div>
                    <button className="btn btn-primary" style={{ padding:"12px" }} onClick={createReseller}>Create Reseller</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab==="manage-resellers" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-title">Reseller Accounts</div><div className="card-sub">{resellers.length} resellers</div></div>
                  <button className="btn btn-sm" onClick={loadResellers}>↻</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Username</th><th>Credit</th><th>Total</th><th>Active</th><th>Unused</th><th>Actions</th></tr></thead>
                    <tbody>
                      {resellers.map(r=>(
                        <tr key={r.id}>
                          <td style={{ fontWeight:700, color:"var(--label-primary)" }}>{r.username}</td>
                          <td style={{ fontWeight:700 }}>{r.credit_balance} cr</td>
                          <td>{r.total_keys}</td>
                          <td style={{ color:"var(--ios-green)", fontWeight:700 }}>{r.active_keys}</td>
                          <td>{r.unused_keys}</td>
                          <td>
                            <div className="td-actions">
                              <button className="btn btn-sm" onClick={()=>addCredit(r.id,r.username)}>+ Credit</button>
                              <button className="btn btn-sm" onClick={()=>openResellerDetail(r.id)}>View</button>
                              <button className="btn btn-sm btn-warn" onClick={()=>banReseller(r.id,r.username)}>Ban</button>
                              <button className="btn btn-sm btn-danger" onClick={()=>deleteReseller(r.id,r.username)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!resellers.length && <tr className="empty-row"><td colSpan="6">No resellers yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {resellerDetail && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">{resellerDetail.reseller.username}</div>
                      <div className="card-sub">Credit: {resellerDetail.reseller.credit_balance} cr</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="btn btn-sm btn-primary" onClick={()=>addCredit(resellerDetail.reseller.id,resellerDetail.reseller.username)}>+ Credit</button>
                      <button className="btn btn-sm" onClick={()=>setResellerDetail(null)}>✕</button>
                    </div>
                  </div>
                  <div className="detail-stats" style={{ marginBottom:16 }}>
                    {[
                      ["Total",resellerDetail.licenses.length],
                      ["Active",resellerDetail.licenses.filter(x=>x.status==="active").length],
                      ["Unused",resellerDetail.licenses.filter(x=>x.status==="unused").length],
                      ["Expired",resellerDetail.licenses.filter(x=>x.status==="expired").length],
                      ["Banned",resellerDetail.licenses.filter(x=>x.status==="banned").length],
                      ["Credit",resellerDetail.reseller.credit_balance],
                    ].map(([label,val])=>(
                      <div key={label} className="detail-stat"><span>{label}</span><b>{val}</b></div>
                    ))}
                  </div>
                  <KeyTable rows={resellerDetail.licenses}
                    onAction={async(k,a)=>{await keyAction(k,a); openResellerDetail(resellerDetail.reseller.id);}}
                    onDevices={openDevices} />
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <DeviceModal data={deviceModal} onClose={()=>setDeviceModal(null)} />
      <ToastArea toasts={toasts} />
    </div>
  );
}
