// Shared utilities — imported by all API routes
import { createClient } from "@supabase/supabase-js";
import { SignJWT, jwtVerify } from "jose";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "change_me");

export async function signToken(payload) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch { return null; }
}

export function getBearer(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function rand(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export function generateLicenseKey(tier = "lite") {
  const prefix = tier === "pro" ? "FFEX-PRO" : "FFEX-LITE";
  return `${prefix}-${rand(4)}-${rand(4)}-${rand(4)}`;
}

export function normalizeKey(k) {
  if (!k) return null;
  return String(k).trim().toUpperCase() || null;
}
