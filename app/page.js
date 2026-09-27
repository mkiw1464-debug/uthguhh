"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const role = localStorage.getItem("ffex_role");
    const token = localStorage.getItem("ffex_token");
    if (token && role === "developer") router.replace("/developer");
    else if (token && role === "admin") router.replace("/admin");
    else if (token && role === "reseller") router.replace("/reseller");
    else router.replace("/login");
  }, [router]);
  return null;
}
