import { supabase, getBearer, verifyToken, generateLicenseKey, normalizeKey } from "../_lib.js";
import { NextResponse } from "next/server";




// FFEX LITE credit prices
const LITE_PRICES = {
  hours_per: 0.1,  // per hour
  "1": 2,
  "7": 8,
  "30": 15,
};

// FFEX PRO credit prices
const PRO_PRICES = {
  hours_per: 0.3,  // per hour
  "1": 4,
  "7": 15,
  "30": 30,
};

async function auth(req) {
  const t = getBearer(req);
  return t ? await verifyToken(t) : null;
}

function calcPrice(durationType, value, productTier) {
  const prices = productTier === "pro" ? PRO_PRICES : LITE_PRICES;
  if (durationType === "hours") {
    const h = Math.max(1, Math.min(24, Math.floor(Number(value))));
    return parseFloat((h * prices.hours_per).toFixed(2));
  }
  if (durationType === "days") {
    const p = prices[String(value)];
    if (p !== undefined) return p;
  }
  return null;
}

export async function GET(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let q = supabase.from("licenses").select("*, users(username)").order("created_at", { ascending: false });

  if (u.role === "developer") {
    // sees all
  } else if (u.role === "admin" || u.role === "reseller") {
    q = q.eq("created_by", u.sub);
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  const expired = (data || [])
    .filter(x => x.expires_at && x.expires_at <= now && x.status === "active")
    .map(x => x.id);

  if (expired.length) {
    await supabase.from("licenses").update({ status: "expired" }).in("id", expired);
  }

  let credit_balance = null;
  if (u.role === "reseller" || u.role === "admin") {
    const user = await supabase.from("users").select("credit_balance,is_banned").eq("id", u.sub).maybeSingle();
    credit_balance = user.data?.credit_balance ?? 0;
    if (user.data?.is_banned) return NextResponse.json({ error:"Banned", banned:true },{ status:403 });
  }

  const licenses = (data || []).map(x => ({
    ...x,
    creator_name: x.users?.username || null,
    users: undefined,
    status: expired.includes(x.id) ? "expired" : x.status,
  }));

  return NextResponse.json({ licenses, credit_balance });
}

export async function POST(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const quantity = Math.min(Math.max(Math.floor(Number(body.quantity || 1)), 1), 1000);
  const durationType = body.duration_type;
  const durationValue = body.duration_value;
  const licenseType = body.license_type === "global" ? "global" : "vip";
  const productTier = body.product_tier === "pro" ? "pro" : "lite";

  if (licenseType === "global" && u.role !== "developer") {
    return NextResponse.json({ error: "Only developer can create global keys" }, { status: 403 });
  }

  let price = calcPrice(durationType, durationValue, productTier);
  if (price === null) return NextResponse.json({ error: "Invalid duration" }, { status: 400 });

  const cost = parseFloat((price * quantity).toFixed(2));

  let newBalance = null;
  if (u.role === "reseller" || u.role === "admin") {
    const debit = await supabase.rpc("decrement_reseller_credit", { p_user_id: u.sub, p_amount: Math.ceil(cost) });
    if (debit.error) {
      const msg = debit.error.message?.toLowerCase().includes("insufficient")
        ? `Insufficient credit. Need ${cost} credit.`
        : debit.error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    newBalance = debit.data;
  }

  const hours = durationType === "hours" ? Math.max(1, Math.min(24, Math.floor(Number(durationValue)))) : null;
  const days  = durationType === "days"  ? Number(durationValue) : null;

  const out = [];
  for (let i = 0; i < quantity; i++) {
    out.push({
      license_key: generateLicenseKey(productTier),
      license_type: licenseType,
      product_tier: productTier,
      created_by: u.role !== "developer" ? u.sub : null,
      duration_hours: hours,
      duration_days: days,
      expires_at: null,
      status: "unused",
    });
  }

  const { data, error } = await supabase.from("licenses").insert(out).select("*");
  if (error) {
    if (u.role === "reseller" || u.role === "admin") {
      await supabase.rpc("increment_reseller_credit", { p_user_id: u.sub, p_amount: Math.ceil(cost) });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ licenses: data, cost, credit_balance: newBalance });
}

export async function PATCH(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { key, action, owner_id, hours } = body;

  // Bulk actions — developer only
  if (action === "ban_all_from") {
    if (u.role !== "developer") return NextResponse.json({ error: "Developer only" }, { status: 403 });
    const r = await supabase.from("licenses").update({ status: "banned" })
      .eq("created_by", owner_id).in("status", ["active","unused"]);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "pause_all") {
    if (u.role !== "developer") return NextResponse.json({ error: "Developer only" }, { status: 403 });
    const r = await supabase.from("licenses").update({ status: "unused", expires_at: null })
      .eq("status", "active");
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "add_time_all") {
    if (u.role !== "developer") return NextResponse.json({ error: "Developer only" }, { status: 403 });
    const h = Math.max(1, Math.floor(Number(hours || 0)));
    const ms = h * 3600000;
    const { data: activeKeys } = await supabase.from("licenses")
      .select("id,expires_at").eq("status", "active").not("expires_at", "is", null);
    if (activeKeys?.length) {
      for (const k of activeKeys) {
        const newExpiry = new Date(new Date(k.expires_at).getTime() + ms).toISOString();
        await supabase.from("licenses").update({ expires_at: newExpiry }).eq("id", k.id);
      }
    }
    return NextResponse.json({ ok: true, updated: activeKeys?.length || 0 });
  }

  // Single key actions
  const k = normalizeKey(key);
  if (!k) return NextResponse.json({ error: "Key required" }, { status: 400 });

  const { data, error } = await supabase.from("licenses").select("*").eq("license_key", k).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  if (u.role === "reseller" && data.created_by !== u.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (u.role === "admin" && data.created_by !== u.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (action === "delete") {
    const r = await supabase.from("licenses").delete().eq("id", data.id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ban" || action === "unban") {
    const status = action === "ban"
      ? "banned"
      : data.expires_at && new Date(data.expires_at) <= new Date()
        ? "expired"
        : data.activated_at ? "active" : "unused";
    const r = await supabase.from("licenses").update({ status }).eq("id", data.id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  }

  if (action === "reset_hwid") {
    const r = await supabase.from("licenses").update({
      hwid: null,
      status: data.status === "active" ? "unused" : data.status,
      activated_at: null,
      expires_at: null,
    }).eq("id", data.id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    await supabase.from("device_logs").delete().eq("license_id", data.id);
    return NextResponse.json({ ok: true, message: "HWID reset. Key is now unused." });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
