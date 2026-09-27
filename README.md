# FFEX License Control v3

Dark monochrome license management system — Developer / Admin / Reseller hierarchy.

---

## 1. Supabase Setup

Buka Supabase SQL Editor dan run `database/schema.sql` sekali. Semua tables dan functions akan dicipta.

### Tables:

| Table | Keterangan |
|---|---|
| `users` | Admin dan Reseller accounts |
| `licenses` | Semua license keys |
| `device_logs` | HWID login history per key |

### Schema licenses (baru):

```
license_type   text — 'vip' | 'global'
duration_hours integer  — untuk key jam (6, 12, 24...)
duration_days  integer  — untuk key hari (7,30,60,90); null=lifetime
hwid           text     — dikunci on first login; null=unused
status         text     — unused | active | banned | expired
```

---

## 2. Environment Variables

`.env.local` (atau Vercel dashboard → Settings → Environment Variables):

```env
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=your-random-secret-min-32-chars
DEVELOPER_USERNAME=akmal
DEVELOPER_PASSWORD=1
```

Ambil dari Supabase: Project Settings → API

---

## 3. Deploy ke Vercel

```bash
npm install -g vercel
vercel --prod
```

Set semua env vars dalam Vercel dashboard dulu.

---

## 4. Login

| Role | Username | Password |
|---|---|---|
| Developer | akmal | 1 |
| Admin | (create dari dev) | (set masa create) |
| Reseller | (create dari dev/admin) | (set masa create) |

---

## 5. Permissions

| Aksi | Developer | Admin | Reseller |
|---|---|---|---|
| Create global key | YES | NO | NO |
| Create VIP key | YES (free) | YES (credit) | YES (credit) |
| View keys | ALL | Own only | Own only |
| Create Admin | YES | NO | NO |
| Create Reseller | YES | YES | NO |
| Add credit to admin | YES | NO | NO |
| Add credit to reseller | YES | YES | NO |
| View reseller keys | YES | Stats only | NO |
| Ban/delete key | All keys | Own only | Own only |

---

## 6. Validate API

```
POST /api/licenses/validate

Body: { "key": "FFEX-XXXXX", "hwid": "DEVICE-ID" }

Success: { "valid": true, "status": "active", "expires_at": "...", ... }
Fail:    { "valid": false, "error": "Key expired" }
```

---

## 7. Credit Prices

| Duration | Credit |
|---|---|
| Per hour | 2 cr/hr |
| 7 Days | 13 cr |
| 30 Days | 27 cr |
| 60 Days | 50 cr |
| 90 Days | 93 cr |
| Lifetime | 350 cr |

Developer keys cost 0 credit.
