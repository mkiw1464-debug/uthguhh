import { supabase, getBearer, verifyToken } from "../_lib.js";
import { NextResponse } from "next/server";
import crypto from "crypto";



const hash = s => crypto.createHash("sha256").update(s).digest("hex");

async function authAdminOrDev(req) {
  const t = getBearer(req);
  const u = t ? await verifyToken(t) : null;
  return u && (u.role === "admin" || u.role === "developer") ? u : null;
}

export async function GET(req) {
  const u = await authAdminOrDev(req);
  if (!u) return NextResponse.json({ error: "Admin or Developer only" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const user = await supabase.from("users")
      .select("id,username,role,credit_balance,is_banned,created_at")
      .eq("id", id).eq("role", "reseller").maybeSingle();
    if (user.error) return NextResponse.json({ error: user.error.message }, { status: 500 });
    if (!user.data) return NextResponse.json({ error: "Reseller not found" }, { status: 404 });

    // Admin can only view resellers they created
    if (u.role === "admin") {
      const ownership = await supabase.from("users")
        .select("created_by_admin").eq("id", id).maybeSingle();
      if (ownership.data?.created_by_admin !== u.sub)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const keys = await supabase.from("licenses").select("*")
      .eq("created_by", id).order("created_at", { ascending: false });
    if (keys.error) return NextResponse.json({ error: keys.error.message }, { status: 500 });
    return NextResponse.json({ reseller: user.data, licenses: keys.data || [] });
  }

  let usersQ = supabase.from("users")
    .select("id,username,role,credit_balance,is_banned,created_at,created_by_admin")
    .eq("role", "reseller").order("created_at", { ascending: false });

  // Admin sees only their own resellers
  if (u.role === "admin") {
    usersQ = usersQ.eq("created_by_admin", u.sub);
  }

  const users = await usersQ;
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });

  const keys = await supabase.from("licenses").select("id,created_by,status");
  if (keys.error) return NextResponse.json({ error: keys.error.message }, { status: 500 });

  const list = (users.data || []).map(r => {
    const mine = (keys.data || []).filter(k => k.created_by === r.id);
    return {
      ...r,
      total_keys: mine.length,
      active_keys: mine.filter(k => k.status === "active").length,
      unused_keys: mine.filter(k => k.status === "unused").length,
      expired_keys: mine.filter(k => k.status === "expired").length,
      banned_keys: mine.filter(k => k.status === "banned").length,
    };
  });

  return NextResponse.json({ resellers: list });
}

export async function POST(req) {
  const u = await authAdminOrDev(req);
  if (!u) return NextResponse.json({ error: "Admin or Developer only" }, { status: 403 });

  const { username, password } = await req.json();
  if (!username || !password || password.length < 4)
    return NextResponse.json({ error: "Username and password (4+ chars) required" }, { status: 400 });

  const { data, error } = await supabase.from("users")
    .insert({
      username,
      password_hash: hash(password),
      role: "reseller",
      created_by_admin: u.role === "admin" ? u.sub : null,
    })
    .select("id,username,role,credit_balance,created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reseller: data });
}

export async function PATCH(req) {
  const u = await authAdminOrDev(req);
  if (!u) return NextResponse.json({ error: "Admin or Developer only" }, { status: 403 });

  const { id, amount, action } = await req.json();

  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const r = await supabase.from("users").delete().eq("id", id).eq("role", "reseller");
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ban") {
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const r = await supabase.from("users").update({ is_banned: true }).eq("id", id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "unban") {
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const r = await supabase.from("users").update({ is_banned: false }).eq("id", id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Add/remove credit
  const value = Math.floor(Number(amount));
  if (!id || !Number.isFinite(value) || value === 0)
    return NextResponse.json({ error: "Credit amount must be non-zero" }, { status: 400 });

  if (value > 0) {
    const result = await supabase.rpc("increment_reseller_credit", { p_user_id: id, p_amount: value });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, credit_balance: result.data });
  } else {
    const abs = Math.abs(value);
    const result = await supabase.rpc("decrement_reseller_credit", { p_user_id: id, p_amount: abs });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, credit_balance: result.data });
  }
}
