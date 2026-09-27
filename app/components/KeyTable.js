"use client";
import { useState } from "react";

function formatDuration(row) {
  if (row.duration_hours) return `${row.duration_hours}h`;
  if (row.duration_days) return `${row.duration_days}d`;
  return "Lifetime";
}

function formatExpiry(row) {
  if (row.expires_at) return new Date(row.expires_at).toLocaleString("ms-MY", {
    day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
  if (row.duration_hours || row.duration_days) return "On activation";
  return "Lifetime";
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {}
}

export default function KeyTable({ rows, onAction, onDevices, canBan=true, canDelete=true, canResetHwid=true, extraActions }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = rows.filter(x => {
    if (filter !== "all" && x.status !== filter) return false;
    if (search && !x.license_key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const STATUS_FILTERS = ["all","unused","active","expired","banned"];

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input
          className="input"
          style={{ maxWidth:200, fontSize:14 }}
          placeholder="Search key…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              className={`btn btn-sm${filter===s?" btn-primary":""}`}
              onClick={()=>setFilter(s)}
              style={{ textTransform:"capitalize" }}
            >
              {s}
            </button>
          ))}
        </div>
        <span style={{ marginLeft:"auto", fontSize:12, color:"var(--label-tertiary)", fontWeight:600 }}>
          {filtered.length}/{rows.length}
        </span>
      </div>

      {extraActions && (
        <div className="manage-actions-bar">
          {extraActions}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>License Key</th>
              <th>Type</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Expiry</th>
              <th>HWID</th>
              <th>Creator</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(x => (
              <tr key={x.id}>
                <td>
                  <span className="key-mono">{x.license_key}</span>
                  <button className="copy-btn" onClick={()=>copyText(x.license_key)}>copy</button>
                </td>
                <td>
                  {x.license_type === "global"
                    ? <span className="pill global">♾ Global</span>
                    : <span className="pill vip">VIP</span>}
                </td>
                <td><span className={`pill ${x.status}`}>{x.status}</span></td>
                <td style={{ fontSize:13, fontWeight:600 }}>{formatDuration(x)}</td>
                <td style={{ fontSize:12, color:"var(--label-tertiary)", fontWeight:500 }}>{formatExpiry(x)}</td>
                <td>
                  {x.hwid
                    ? <span style={{ fontFamily:"monospace", fontSize:10, color:"var(--label-secondary)" }}>
                        {x.hwid.slice(0,14)}…
                      </span>
                    : <span style={{ color:"var(--label-quaternary)" }}>—</span>}
                </td>
                <td style={{ fontSize:12, color:"var(--label-tertiary)", fontWeight:500 }}>
                  {x.creator_name || "dev"}
                </td>
                <td>
                  <div className="td-actions">
                    <button className="btn btn-sm" onClick={()=>onDevices(x.license_key)}>Devices</button>
                    {canResetHwid && x.license_type !== "global" && x.hwid && (
                      <button className="btn btn-sm btn-warn" onClick={()=>onAction(x.license_key,"reset_hwid")}>
                        Reset HWID
                      </button>
                    )}
                    {canBan && (
                      <button
                        className={`btn btn-sm${x.status==="banned"?" btn-success":" btn-warn"}`}
                        onClick={()=>onAction(x.license_key, x.status==="banned"?"unban":"ban")}
                      >
                        {x.status==="banned" ? "Unban" : "Ban"}
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn btn-sm btn-danger" onClick={()=>{
                        if(confirm(`Delete ${x.license_key}?`)) onAction(x.license_key,"delete");
                      }}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr className="empty-row"><td colSpan="8">No keys found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
