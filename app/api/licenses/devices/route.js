import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "change_me");

async function auth(req) {
  try {
    const h = req.headers.get("authorization") || "";
    if (!h.startsWith("Bearer ")) return null;
    const token = h.slice(7).trim();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch { return null; }
}

export async function GET(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = (new URL(req.url).searchParams.get("key") || "").trim().toUpperCase();
  if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

  const { data: lic, error } = await supabase
    .from("licenses").select("id,license_key,license_type,created_by").eq("license_key", key).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lic) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  if ((u.role === "reseller" || u.role === "admin") && lic.created_by !== u.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: logs, error: le } = await supabase
    .from("device_logs").select("*").eq("license_id", lic.id).order("validated_at", { ascending: false });
  if (le) return NextResponse.json({ error: le.message }, { status: 500 });

  return NextResponse.json({ key, license_type: lic.license_type, logs: logs || [] });
}
