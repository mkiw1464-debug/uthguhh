import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { SignJWT, jwtVerify } from "jose";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "change_me");
const hash = s => crypto.createHash("sha256").update(s).digest("hex");

async function signToken(payload) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret);
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (!username || !password)
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });

    if (username === process.env.DEVELOPER_USERNAME && password === process.env.DEVELOPER_PASSWORD) {
      const token = await signToken({ sub: "developer", role: "developer", username });
      return NextResponse.json({ token, role: "developer" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id,username,password_hash,role,credit_balance,is_banned")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.password_hash !== hash(password))
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const token = await signToken({ sub: data.id, role: data.role, username: data.username });
    return NextResponse.json({ token, role: data.role, is_banned: data.is_banned || false });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
