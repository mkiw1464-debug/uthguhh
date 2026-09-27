import { NextResponse } from "next/server";
import { supabase, normalizeKey } from "../_lib.js";

export async function POST(req) {
  try {
    const { key, hwid } = await req.json();
    const k = normalizeKey(key);
    if (!k || !hwid) return NextResponse.json({ valid: false, error: "Key and HWID required" }, { status: 400 });

    const { data, error } = await supabase
      .from("licenses").select("*").eq("license_key", k).maybeSingle();
    if (error) return NextResponse.json({ valid: false, error: "Server error" }, { status: 500 });
    if (!data) return NextResponse.json({ valid: false, error: "Invalid key" });

    if (data.status === "banned")   return NextResponse.json({ valid: false, error: "Key banned" });
    if (data.status === "expired")  return NextResponse.json({ valid: false, error: "Key expired" });

    const now = new Date();

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) <= now) {
      await supabase.from("licenses").update({ status: "expired" }).eq("id", data.id);
      return NextResponse.json({ valid: false, error: "Key expired" });
    }

    // Global key — unlimited devices
    if (data.license_type === "global") {
      if (data.status === "unused") {
        const expiresAt = calcExpiry(data, now);
        await supabase.from("licenses").update({
          status: "active", activated_at: now.toISOString(), expires_at: expiresAt,
        }).eq("id", data.id);
      }
      await supabase.from("device_logs").insert({
        license_id: data.id, hwid, ip_address: req.headers.get("x-forwarded-for") || null,
      });
      const updated = await supabase.from("licenses").select("expires_at").eq("id", data.id).maybeSingle();
      return NextResponse.json({ valid: true, status: "active", license_type: "global", is_global: true, expires_at: updated.data?.expires_at });
    }

    // VIP key — HWID lock
    if (data.status === "unused") {
      const expiresAt = calcExpiry(data, now);
      await supabase.from("licenses").update({
        status: "active", hwid, activated_at: now.toISOString(), expires_at: expiresAt,
      }).eq("id", data.id);
      await supabase.from("device_logs").insert({
        license_id: data.id, hwid, ip_address: req.headers.get("x-forwarded-for") || null,
      });
      const updated = await supabase.from("licenses").select("expires_at").eq("id", data.id).maybeSingle();
      return NextResponse.json({ valid: true, status: "active", license_type: "vip", is_global: false, hwid, expires_at: updated.data?.expires_at });
    }

    if (data.status === "active") {
      if (data.hwid && data.hwid !== hwid)
        return NextResponse.json({ valid: false, error: "HWID mismatch" });
      await supabase.from("device_logs").insert({
        license_id: data.id, hwid, ip_address: req.headers.get("x-forwarded-for") || null,
      });
      return NextResponse.json({ valid: true, status: "active", license_type: data.license_type, is_global: false, hwid: data.hwid, expires_at: data.expires_at });
    }

    return NextResponse.json({ valid: false, error: "Invalid key state" });
  } catch {
    return NextResponse.json({ valid: false, error: "Server error" }, { status: 500 });
  }
}

function calcExpiry(data, now) {
  if (data.duration_hours) return new Date(now.getTime() + data.duration_hours * 3600000).toISOString();
  if (data.duration_days)  return new Date(now.getTime() + data.duration_days * 86400000).toISOString();
  return null;
}
