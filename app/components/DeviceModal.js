"use client";

export default function DeviceModal({ data, onClose }) {
  if (!data) return null;
  const { key, logs, license_type } = data;
  const isGlobal = license_type === "global";

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Device History</div>
            <div className="modal-sub">
              <span className="key-mono">{key}</span>
              {isGlobal && <span className="pill global" style={{ marginLeft:8, fontSize:11 }}>♾ Global</span>}
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        {(!logs || logs.length === 0) ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--label-tertiary)", fontSize:15, fontWeight:500 }}>
            No device logins recorded yet.
          </div>
        ) : (
          <div>
            <div style={{ fontSize:12, color:"var(--label-tertiary)", marginBottom:14, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              {logs.length} login{logs.length!==1?"s":""} recorded
            </div>
            {logs.map((log) => (
              <div key={log.id} className="device-item">
                <div>
                  <div className="hwid-text">{log.hwid}</div>
                  {log.ip_address && (
                    <div style={{ fontSize:12, color:"var(--label-tertiary)", marginTop:3, fontWeight:500 }}>
                      IP: {log.ip_address}
                    </div>
                  )}
                </div>
                <div className="device-meta">
                  {new Date(log.validated_at).toLocaleString("ms-MY", {
                    day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
