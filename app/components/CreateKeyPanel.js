"use client";
import { useState } from "react";

// FFEX LITE pricing (hour-based)
const LITE_HOUR_PRICES = {
  1: 0.1, 2: 0.2, 3: 0.3, 4: 0.4, 5: 0.5, 6: 0.6, 7: 0.7, 8: 0.8,
  9: 0.9, 10: 1.0, 12: 1.2, 16: 1.6, 18: 1.8, 20: 2.0, 24: 2.4
};

// FFEX PRO pricing (hour-based)
const PRO_HOUR_PRICES = {
  1: 0.3, 2: 0.6, 3: 0.9, 4: 1.2, 5: 1.5, 6: 1.8, 8: 2.4,
  10: 3.0, 12: 3.6, 16: 4.8, 18: 5.4, 20: 6.0, 24: 7.2
};

// Day-based prices — Lite
const LITE_DAY_OPTIONS = [
  { key: "1",   label: "1 Day",   cr: 2  },
  { key: "7",   label: "7 Days",  cr: 8  },
  { key: "30",  label: "30 Days", cr: 15 },
];

// Day-based prices — Pro
const PRO_DAY_OPTIONS = [
  { key: "1",   label: "1 Day",   cr: 4  },
  { key: "7",   label: "7 Days",  cr: 15 },
  { key: "30",  label: "30 Days", cr: 30 },
];

const HOUR_OPTIONS = [1,2,3,4,5,6,8,10,12,16,18,20,24];

export default function CreateKeyPanel({ role, balance, onCreated, push, token }) {
  const [product, setProduct]   = useState("lite");  // "lite" | "pro" (dev only)
  const [mode, setMode]         = useState("days");   // "hours" | "days"
  const [hours, setHours]       = useState(1);
  const [days, setDays]         = useState("1");
  const [qty, setQty]           = useState(1);
  const [licType, setLicType]   = useState("vip");   // "vip" | "global" (dev only)
  const [busy, setBusy]         = useState(false);

  const isDev          = role === "developer";
  const hasCreditSystem = role === "reseller" || role === "admin";

  const dayOptions = product === "pro" ? PRO_DAY_OPTIONS : LITE_DAY_OPTIONS;

  function getCost() {
    if (!hasCreditSystem) return 0;
    const q = Math.max(1, Number(qty || 1));
    if (mode === "hours") {
      const priceMap = product === "pro" ? PRO_HOUR_PRICES : LITE_HOUR_PRICES;
      const h = Math.max(1, Math.min(24, Number(hours)));
      const perHour = product === "pro" ? 0.3 : 0.1;
      return parseFloat((h * perHour * q).toFixed(2));
    }
    const opt = dayOptions.find(o => o.key === days);
    return parseFloat(((opt?.cr ?? 0) * q).toFixed(2));
  }

  const cost = getCost();
  const insufficient = hasCreditSystem && cost > (balance ?? 0);

  async function generate() {
    setBusy(true);
    try {
      const q = Math.max(1, Number(qty));
      const body = {
        quantity: q,
        license_type: licType,
        product_tier: product,
        duration_type: mode === "hours" ? "hours" : "days",
        duration_value: mode === "hours"
          ? Math.max(1, Math.min(24, Number(hours)))
          : Number(days),
      };
      const r = await fetch("/api/licenses", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");

      // Auto-copy if single key
      if (d.licenses?.length === 1) {
        try { await navigator.clipboard.writeText(d.licenses[0].license_key); } catch {}
        push(`Key created & copied: ${d.licenses[0].license_key}${d.cost ? ` — ${d.cost} cr used` : ""}`, "ok");
      } else {
        // Bulk: offer download
        const lines = d.licenses.map(l => l.license_key).join("\n");
        const blob = new Blob([lines], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const now = new Date().toISOString().slice(0,10).replace(/-/g,"");
        const tier = product.toUpperCase();
        a.href = url;
        a.download = `FFEX-${tier}-${now}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        push(`${d.licenses.length} keys created — downloading .txt${d.cost ? ` — ${d.cost} cr used` : ""}`, "ok");
      }

      onCreated(d.licenses, d.credit_balance);
    } catch (e) { push(e.message, "err"); }
    finally { setBusy(false); }
  }

  const currentHr = Math.max(1, Math.min(24, Number(hours)));
  const hrCostPer = product === "pro" ? 0.3 : 0.1;

  return (
    <div>
      {/* Product tier — dev only */}
      {isDev && (
        <div style={{ marginBottom: 16 }}>
          <div className="field-label">Product</div>
          <div style={{ display:"flex", gap:8 }}>
            {["lite","pro"].map(p => (
              <button key={p} className={`btn${product===p?" btn-primary":""}`} onClick={()=>setProduct(p)}>
                FFEX {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Key type — dev only */}
      {isDev && (
        <div style={{ marginBottom: 16 }}>
          <div className="field-label">Key Type</div>
          <div style={{ display:"flex", gap:8 }}>
            <button className={`btn${licType==="vip"?" btn-primary":""}`} onClick={()=>setLicType("vip")}>
              🔒 VIP (1 HWID)
            </button>
            <button className={`btn${licType==="global"?" btn-primary":""}`} onClick={()=>setLicType("global")}>
              ♾ Global (Unlimited)
            </button>
          </div>
        </div>
      )}

      {/* Duration mode */}
      <div style={{ marginBottom: 16 }}>
        <div className="field-label">Duration Type</div>
        <div style={{ display:"flex", gap:8 }}>
          {["hours","days"].map(m => (
            <button key={m} className={`btn${mode===m?" btn-primary":""}`} onClick={()=>setMode(m)}>
              {m === "hours" ? "⏱ Hour-based" : "📅 Day-based"}
            </button>
          ))}
        </div>
      </div>

      {mode === "hours" ? (
        <div style={{ marginBottom: 16 }}>
          <div className="field-label">Hours (1–24)</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            {HOUR_OPTIONS.map(h => (
              <button
                key={h}
                className={`btn btn-sm${hours===h?" btn-primary":""}`}
                onClick={()=>setHours(h)}
                style={{ minWidth:44 }}
              >
                {h}h
              </button>
            ))}
          </div>
          {hasCreditSystem && (
            <div style={{ fontSize:13, color:"var(--label-tertiary)", fontWeight:500 }}>
              {hrCostPer} cr × {currentHr}h = <strong style={{color:"var(--label-primary)"}}>{parseFloat((hrCostPer*currentHr).toFixed(2))} cr each</strong>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div className="field-label">Duration</div>
          <div className="price-grid">
            {dayOptions.map(o => (
              <div
                key={o.key}
                className={`price-tile${days===o.key?" selected":""}`}
                onClick={()=>setDays(o.key)}
              >
                <div className="dur">{o.label}</div>
                {hasCreditSystem && <div className="cr">{o.cr} cr</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Quantity</label>
        <input
          className="input"
          type="number"
          min="1"
          max="1000"
          value={qty}
          onChange={e=>setQty(e.target.value)}
          style={{ maxWidth:120 }}
        />
        {Number(qty) > 1 && (
          <div style={{fontSize:13,color:"var(--label-tertiary)",marginTop:4,fontWeight:500}}>
            Bulk: {qty} keys → download as FFEX-{product.toUpperCase()}-*.txt
          </div>
        )}
      </div>

      {/* Cost summary */}
      {hasCreditSystem && (
        <div style={{
          background:"var(--bg-primary)",
          borderRadius:"var(--radius-sm)",
          padding:"14px 16px",
          marginBottom:16,
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          border:"1px solid var(--separator)",
        }}>
          <div>
            <div style={{fontSize:12,color:"var(--label-tertiary)",marginBottom:2,fontWeight:600}}>Total cost</div>
            <div style={{fontSize:26,fontWeight:800,color:insufficient?"var(--ios-red)":"var(--label-primary)",letterSpacing:"-0.5px"}}>
              {cost} cr
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,color:"var(--label-tertiary)",marginBottom:2,fontWeight:600}}>Balance</div>
            <div style={{fontSize:18,fontWeight:800,color:"var(--label-primary)",letterSpacing:"-0.3px"}}>
              {balance ?? 0} cr
            </div>
          </div>
        </div>
      )}

      {insufficient && (
        <div style={{fontSize:13,color:"var(--ios-red)",marginBottom:12,fontWeight:600}}>
          ⚠ Insufficient credit — need {cost}, have {balance}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={generate}
        disabled={busy || insufficient}
        style={{ width:"100%", padding:"14px", fontSize:17 }}
      >
        {busy
          ? <><span className="spinner" /> Creating…</>
          : Number(qty)===1
            ? "Generate & Copy Key"
            : `Generate ${qty} Keys (Download .txt)`
        }
      </button>
    </div>
  );
}
