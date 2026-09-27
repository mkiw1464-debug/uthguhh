"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ffex_theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const val = next ? "dark" : "light";
    localStorage.setItem("ffex_theme", val);
    document.documentElement.setAttribute("data-theme", val);
  }

  return (
    <button className="theme-toggle" onClick={toggle} title={dark ? "Switch to light" : "Switch to dark"}>
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
