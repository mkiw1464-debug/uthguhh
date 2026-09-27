"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { ToastArea, useToast } from "../components/Toast";
import KeyTable from "../components/KeyTable";
import DeviceModal from "../components/DeviceModal";
import CreateKeyPanel from "../components/CreateKeyPanel";
import ThemeToggle from "../components/ThemeToggle";

export default function Developer() {
  const [token, setToken]       = useState("");
  const [username, setUsername] = useState("");
  const [tab, setTab]           = useState("create");
  const [keys, setKeys]         = useState([]);
  const [admins, setAdmins]     = useState([]);
  const [resellers, setResellers] = useState([]);
  const [deviceModal, setDeviceModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminDetail, setAdminDetail] = useState(null);
  const [resellerDetail, setResellerDetail] = useState(null);
  const [newUser, setNewUser]   = useState({ username:"", password:"" });
  const { toasts, push }        = useToast();
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("ffex_token");
    const r = localStorage.getItem("ffex_role");
    const u = localStorage.getItem("ffex_username");
    if (!t || r !== "developer") { router.replace("/login"); return; }
    setToken(t); setUsername(u || "developer");
  }, [router]);

  useEffect(() => { if (token && tab === "manage-keys") loadKeys(); }, [token]);

  async function api(path, opts={}) {
    const r = await fetch(path, {
      ...opts,
      headers: { ...(opts.headers||{}), Authorization:`Bearer ${token}`, "content-type":"application/json" },
    });
    const d = await r.json();
    if (r.status === 401) { router.replace("/login"); throw new Error("Session expired"); }
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  }

  async function loadKeys() {
    try { setKeys((await api("/api/licenses")).licenses || []); }
    catch(e) { push(e.message,"err"); }
  }

  async function loadAdmins() {
    try { setAdmins((await api("/api/admins")).admins || []); }
    catch(e) { push(e.message,"err"); }
  }

  async function loadResellers() {
    try { setResellers((await api("/api/resellers")).resellers || []); }
    catch(e) { push(e.message,"err"); }
  }

  async function openAdminDetail(id) {
    try { setAdminDetail(await api(`/api/admins?id=${id}`)); }
    catch(e) { push(e.message,"err"); }
  }

  async function openResellerDetail(id) {
    try { setResellerDetail(await api(`/api/resellers?id=${id}`)); }
    catch(e) { push(e.message,"err"); }
  }

  function changeTab(t) {
    setTab(t);
    setAdminDetail(null); setResellerDetail(null);
    if (t==="manage-keys") loadKeys();
    if (t==="manage-admins") loadAdmins();
    if (t==="manage-resellers") loadResellers();
  }

  async function keyAction(key, action) {
    try {
      const d = await api("/api/licenses", { method:"PATCH", body:JSON.stringify({ key, action }) });
      if (action==="reset_hwid") push(d.message||"HWID reset","ok");
      else push(`Key ${action}d`,"ok");
      loadKeys();
      if (adminDetail) openAdminDetail(adminDetail.admin.id);
      if (resellerDetail) openResellerDetail(resellerDetail.reseller.id);
    } catch(e) { push(e.message,"err"); }
  }

  async function openDevices(key) {
    try { setDeviceModal(await api(`/api/licenses/devices?key=${encodeURIComponent(key)}`).then(d=>({key,...d}))); }
    catch(e) { push(e.message,"err"); }
  }

  async function banAllKeysFrom(type, id, name) {
    if (!confirm(`Ban ALL keys created by ${name}?`)) return;
    try {
      await api("/api/licenses", { method:"PATCH", body:JSON.stringify({ action:"ban_all_from", owner_id:id }) });
      push(`All keys from ${name} banned`,"ok");
      loadKeys();
    } catch(e) { push(e.message,"err"); }
  }

  async function createUser(role) {
    if (!newUser.username || !newUser.password) { push("Fill all fields","err"); return; }
    try {
      const ep = role==="admin" ? "/api/admins" : "/api/resellers";
      await api(ep, { method:"POST", body:JSON.stringify(newUser) });
      push(`${role==="admin"?"Admin":"Reseller"} created`,"ok");
      setNewUser({ username:"", password:"" });
      if (role==="admin") loadAdmins(); else loadResellers();
    } catch(e) { push(e.message,"err"); }
  }

  async function deleteUser(ep, id, name, role) {
    if (!confirm(`Delete ${role} ${name}?`)) return;
    try {
      await api(ep, { method:"PATCH", body:JSON.stringify({ id, action:"delete" }) });
      push(`${role} deleted`,"ok");
      if (role==="Admin") { setAdminDetail(null); loadAdmins(); }
      else { setResellerDetail(null); loadResellers(); }
    } catch(e) { push(e.message,"err"); }
  }

  async function banUser(ep, id, name, role) {
    if (!confirm(`Ban ${role} ${name}? They can still login but will see ban notice.`)) return;
    try {
      await api(ep, { method:"PATCH", body:JSON.stringify({ id, action:"ban" }) });
      push(`${role} banned`,"ok");
      if (role==="Admin") loadAdmins(); else loadResellers();
    } catch(e) { push(e.message,"err"); }
  }

  async function unbanUser(ep, id, name, role) {
    try {
      await api(ep, { method:"PATCH", body:JSON.stringify({ id, action:"unban" }) });
      push(`${role} unbanned`,"ok");
      if (role==="Admin") loadAdmins(); else loadResellers();
    } catch(e) { push(e.message,"err"); }
  }

  async function addCredit(endpoint, id, name) {
    const raw = prompt(`Add credit to ${name}:`, "100");
    if (raw===null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount)||amount<=0) { push("Enter valid amount","err"); return; }
    try {
      const d = await api(endpoint, { method:"PATCH", body:JSON.stringify({ id, amount }) });
      push(`Added ${amount} cr to ${name}. Balance: ${d.credit_balance}`,"ok");
      if (tab==="manage-admins") { loadAdmins(); if(adminDetail) openAdminDetail(id); }
      if (tab==="manage-resellers") { loadResellers(); if(resellerDetail) openResellerDetail(id); }
    } catch(e) { push(e.message,"err"); }
  }

  async function deleteCredit(endpoint, id, name) {
    const raw = prompt(`Remove credit from ${name}:`, "50");
    if (raw===null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount)||amount<=0) { push("Enter valid amount","err"); return; }
    try {
      const d = await api(endpoint, { method:"PATCH", body:JSON.stringify({ id, amount:-amount }) });
      push(`Removed ${amount} cr from ${name}. Balance: ${d.credit_balance}`,"ok");
      if (tab==="manage-admins") { loadAdmins(); if(adminDetail) openAdminDetail(id); }
      if (tab==="manage-resellers") { loadResellers(); if(resellerDetail) openResellerDetail(id); }
    } catch(e) { push(e.message,"err"); }
  }

  async function addTimeAllKeys() {
    const raw = prompt("Add time to ALL active/unused keys (hours):", "24");
    if (raw===null) return;
    const hours = Number(raw);
    if (!Number.isFinite(hours)||hours<=0) { push("Enter valid hours","err"); return; }
    try {
      await api("/api/licenses", { method:"PATCH", body:JSON.stringify({ action:"add_time_all", hours }) });
      push(`Added ${hours}h to all active keys`,"ok");
      loadKeys();
    } catch(e) { push(e.message,"err"); }
  }

  async function pauseAllKeys() {
    if (!confirm("Pause ALL active keys? (sets status to unused, time stops)")) return;
    try {
      await api("/api/licenses", { method:"PATCH", body:JSON.stringify({ action:"pause_all" }) });
      push("All active keys paused","ok");
      loadKeys();
    } catch(e) { push(e.message,"err"); }
  }

  const active   = keys.filter(x=>x.status==="active").length;
  const unused   = keys.filter(x=>x.status==="unused").length;
  const expired  = keys.filter(x=>x.status==="expired").length;
  const globals  = keys.filter(x=>x.license_type==="global").length;

  const TITLES = {
    create:"Create Key", admins:"Create Admin", resellers:"Create Reseller",
    "manage-keys":"Manage Keys", "manage-admins":"Manage Admins", "manage-resellers":"Manage Resellers"
  };

  function UserForm({ roleLabel }) {
    return (
      <div className="card">
        <div className="card-header"><div className="card-title">Create {roleLabel}</div></div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label className="field-label">Username</label>
            <input className="input" value={newUser.username}
              onChange={e=>setNewUser(p=>({...p,username:e.target.value}))}
              placeholder={`${roleLabel.toLowerCase()}_name`} />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="input" type="password" value={newUser.password}
              onChange={e=>setNewUser(p=>({...p,password:e.target.value}))}
              placeholder="min 4 chars" />
          </div>
          <button className="btn btn-primary" style={{padding:"12px"}}
            onClick={()=>createUser(roleLabel.toLowerCase())}>
            Create {roleLabel}
          </button>
        </div>
      </div>
    );
  }

  function UserList({ users, type, endpoint, roleLabel }) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{roleLabel} Accounts</div>
            <div className="card-sub">{users.length} {roleLabel.toLowerCase()}s</div>
          </div>
          <button className="btn btn-sm" onClick={()=>type==="admin"?loadAdmins():loadResellers()}>↻</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Username</th><th>Credit</th><th>Keys</th><th>Active</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td style={{ fontWeight:700, color:"var(--label-primary)" }}>{u.username}</td>
                  <td style={{ fontWeight:700 }}>{u.credit_balance} cr</td>
                  <td>{u.total_keys}</td>
                  <td style={{ color:"var(--ios-green)", fontWeight:700 }}>{u.active_keys}</td>
                  <td>
                    <span className={`pill ${u.is_banned?"banned":"active"}`}>
                      {u.is_banned?"Banned":"Active"}
                    </span>
                  </td>
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-sm" onClick={()=>addCredit(endpoint,u.id,u.username)}>+ Credit</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteCredit(endpoint,u.id,u.username)}>− Credit</button>
                      <button className="btn btn-sm" onClick={()=>type==="admin"?openAdminDetail(u.id):openResellerDetail(u.id)}>View</button>
                      {u.is_banned
                        ? <button className="btn btn-sm btn-success" onClick={()=>unbanUser(endpoint,u.id,u.username,roleLabel)}>Unban</button>
                        : <button className="btn btn-sm btn-warn" onClick={()=>banUser(endpoint,u.id,u.username,roleLabel)}>Ban</button>
                      }
                      <button className="btn btn-sm" onClick={()=>banAllKeysFrom(type,u.id,u.username)}>Ban All Keys</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteUser(endpoint,u.id,u.username,roleLabel)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && <tr className="empty-row"><td colSpan="6">No {roleLabel.toLowerCase()}s yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={()=>setSidebarOpen(o=>!o)}>
        <span/><span/><span/>
      </button>

      <Sidebar role="developer" activeTab={tab} onTabChange={changeTab} username={username}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">{TITLES[tab]||tab}</div>
          <div className="topbar-actions">
            <button className="btn btn-sm" onClick={()=>changeTab(tab)}>↻ Refresh</button>
            <ThemeToggle />
          </div>
        </header>

        <main className="page-content">

          {/* ---- CREATE KEY ---- */}
          {tab==="create" && (
            <div className="grid-12">
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Generate Keys</div></div>
                  <CreateKeyPanel role="developer" balance={null} token={token}
                    onCreated={(newKeys)=>{ push(`${newKeys.length} key(s) created`,"ok"); }}
                    push={push} />
                </div>
              </div>
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Key Info</div></div>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      ["VIP Key", "🔒 HWID locked on first login (1 device)"],
                      ["Global Key", "♾ Unlimited devices, no lock — Developer only"],
                      ["Hour-based", "Starts counting on activation"],
                      ["Day-based", "Starts counting on activation"],
                    ].map(([t,d])=>(
                      <div key={t} style={{ background:"var(--bg-primary)", borderRadius:"var(--radius-sm)", padding:"12px 14px" }}>
                        <div style={{ fontWeight:700, color:"var(--label-primary)", fontSize:14, marginBottom:3 }}>{t}</div>
                        <div style={{ fontSize:13, color:"var(--label-tertiary)", fontWeight:500 }}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- CREATE ADMIN ---- */}
          {tab==="admins" && (
            <div className="grid-12">
              <div className="col-6">
                <UserForm roleLabel="Admin" />
              </div>
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Admin Permissions</div></div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      ["✅","Unlimited credit to create keys"],
                      ["✅","Can add credit to resellers they created"],
                      ["✅","Can delete/ban resellers they created"],
                      ["✅","Can view keys their resellers created"],
                      ["❌","Cannot create global keys"],
                      ["❌","Cannot manage other admins"],
                    ].map(([icon,text])=>(
                      <div key={text} style={{ display:"flex", gap:10, fontSize:14, fontWeight:500 }}>
                        <span>{icon}</span>
                        <span style={{ color:"var(--label-secondary)" }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- CREATE RESELLER ---- */}
          {tab==="resellers" && (
            <div className="grid-12">
              <div className="col-6">
                <UserForm roleLabel="Reseller" />
              </div>
              <div className="col-6">
                <div className="card">
                  <div className="card-header"><div className="card-title">Reseller Permissions</div></div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      ["✅","Create keys using credit balance"],
                      ["✅","Delete/ban their own keys"],
                      ["✅","View only keys they created"],
                      ["❌","Cannot create admins/resellers"],
                      ["❌","Cannot access global keys"],
                      ["❌","Cannot add credit to others"],
                    ].map(([icon,text])=>(
                      <div key={text} style={{ display:"flex", gap:10, fontSize:14, fontWeight:500 }}>
                        <span>{icon}</span>
                        <span style={{ color:"var(--label-secondary)" }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- MANAGE KEYS ---- */}
          {tab==="manage-keys" && (
            <div>
              <div className="stats-row" style={{ marginBottom:20 }}>
                <div className="stat-card">
                  <div className="stat-label">Total</div>
                  <div className="stat-value">{keys.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Active</div>
                  <div className="stat-value green">{active}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Unused</div>
                  <div className="stat-value">{unused}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Global</div>
                  <div className="stat-value blue">{globals}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">All License Keys</div>
                    <div className="card-sub">All keys across system</div>
                  </div>
                </div>
                <KeyTable
                  rows={keys}
                  onAction={keyAction}
                  onDevices={openDevices}
                  extraActions={
                    <>
                      <button className="btn btn-sm btn-warn" onClick={pauseAllKeys}>⏸ Pause All Keys</button>
                      <button className="btn btn-sm btn-primary" onClick={addTimeAllKeys}>+ Add Time All Keys</button>
                    </>
                  }
                />
              </div>
            </div>
          )}

          {/* ---- MANAGE ADMINS ---- */}
          {tab==="manage-admins" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <UserList users={admins} type="admin" endpoint="/api/admins" roleLabel="Admin" />
              {adminDetail && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">{adminDetail.admin.username}</div>
                      <div className="card-sub">Admin detail</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="btn btn-sm btn-primary" onClick={()=>addCredit("/api/admins",adminDetail.admin.id,adminDetail.admin.username)}>+ Credit</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteUser("/api/admins",adminDetail.admin.id,adminDetail.admin.username,"Admin")}>Delete</button>
                      <button className="btn btn-sm" onClick={()=>setAdminDetail(null)}>✕</button>
                    </div>
                  </div>
                  <div className="detail-stats" style={{ marginBottom:16 }}>
                    {[
                      ["Credit",adminDetail.admin.credit_balance],
                      ["Total",adminDetail.licenses.length],
                      ["Active",adminDetail.licenses.filter(x=>x.status==="active").length],
                      ["Unused",adminDetail.licenses.filter(x=>x.status==="unused").length],
                      ["Expired",adminDetail.licenses.filter(x=>x.status==="expired").length],
                      ["Banned",adminDetail.licenses.filter(x=>x.status==="banned").length],
                    ].map(([label,val])=>(
                      <div key={label} className="detail-stat">
                        <span>{label}</span><b>{val}</b>
                      </div>
                    ))}
                  </div>
                  <KeyTable rows={adminDetail.licenses}
                    onAction={async(k,a)=>{await keyAction(k,a); openAdminDetail(adminDetail.admin.id);}}
                    onDevices={openDevices} />
                </div>
              )}
            </div>
          )}

          {/* ---- MANAGE RESELLERS ---- */}
          {tab==="manage-resellers" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <UserList users={resellers} type="reseller" endpoint="/api/resellers" roleLabel="Reseller" />
              {resellerDetail && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">{resellerDetail.reseller.username}</div>
                      <div className="card-sub">Reseller detail</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="btn btn-sm btn-primary" onClick={()=>addCredit("/api/resellers",resellerDetail.reseller.id,resellerDetail.reseller.username)}>+ Credit</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteUser("/api/resellers",resellerDetail.reseller.id,resellerDetail.reseller.username,"Reseller")}>Delete</button>
                      <button className="btn btn-sm" onClick={()=>setResellerDetail(null)}>✕</button>
                    </div>
                  </div>
                  <div className="detail-stats" style={{ marginBottom:16 }}>
                    {[
                      ["Credit",resellerDetail.reseller.credit_balance],
                      ["Total",resellerDetail.licenses.length],
                      ["Active",resellerDetail.licenses.filter(x=>x.status==="active").length],
                      ["Unused",resellerDetail.licenses.filter(x=>x.status==="unused").length],
                      ["Expired",resellerDetail.licenses.filter(x=>x.status==="expired").length],
                      ["Banned",resellerDetail.licenses.filter(x=>x.status==="banned").length],
                    ].map(([label,val])=>(
                      <div key={label} className="detail-stat">
                        <span>{label}</span><b>{val}</b>
                      </div>
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
