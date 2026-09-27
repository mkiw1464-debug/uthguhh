"use client";
import { useRouter } from "next/navigation";

const ICONS = {
  keys: "🔑",
  create: "✚",
  "manage-keys": "⚙️",
  resellers: "👥",
  admins: "👤",
  "manage-resellers": "📋",
  "manage-admins": "📋",
};

export default function Sidebar({ role, activeTab, onTabChange, username, sidebarOpen, setSidebarOpen }) {
  const router = useRouter();

  function logout() {
    localStorage.removeItem("ffex_token");
    localStorage.removeItem("ffex_role");
    localStorage.removeItem("ffex_username");
    router.replace("/login");
  }

  const devMenus = [
    {
      section: "Create",
      items: [
        { id: "create",         label: "Create Key",       icon: "create" },
        { id: "admins",         label: "Create Admin",     icon: "admins" },
        { id: "resellers",      label: "Create Reseller",  icon: "resellers" },
      ]
    },
    {
      section: "Manage",
      items: [
        { id: "manage-keys",      label: "Manage Keys",      icon: "manage-keys" },
        { id: "manage-admins",    label: "Manage Admins",    icon: "manage-admins" },
        { id: "manage-resellers", label: "Manage Resellers", icon: "manage-resellers" },
      ]
    }
  ];

  const adminMenus = [
    {
      section: "Create",
      items: [
        { id: "create",         label: "Create Key",       icon: "create" },
        { id: "resellers",      label: "Create Reseller",  icon: "resellers" },
      ]
    },
    {
      section: "Manage",
      items: [
        { id: "keys",           label: "My Keys",          icon: "keys" },
        { id: "manage-resellers", label: "Manage Resellers", icon: "manage-resellers" },
      ]
    }
  ];

  const resellerMenus = [
    {
      section: "Dashboard",
      items: [
        { id: "keys",   label: "My Keys",    icon: "keys" },
        { id: "create", label: "Create Key", icon: "create" },
      ]
    }
  ];

  const menuGroups = role === "developer" ? devMenus : role === "admin" ? adminMenus : resellerMenus;
  const roleLabel = { developer: "Developer", admin: "Admin", reseller: "Reseller" }[role] || role;
  const initial = (username || "U")[0].toUpperCase();

  return (
    <>
      {sidebarOpen && (
        <div
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:39,backdropFilter:"blur(4px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="mark">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M3 4h14M3 10h10M3 16h7" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="wordmark">FFEX</div>
            <div className="role-tag">{roleLabel}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {menuGroups.map((group) => (
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(m => (
                <button
                  key={m.id}
                  className={`nav-item${activeTab === m.id ? " active" : ""}`}
                  onClick={() => { onTabChange(m.id); setSidebarOpen(false); }}
                >
                  <span className="nav-icon">{ICONS[m.icon] || "•"}</span>
                  {m.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initial}</div>
            <div>
              <div className="user-name">{username || "User"}</div>
              <div className="user-role">{roleLabel}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            🚪 Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
