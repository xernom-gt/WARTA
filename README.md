# Warta

**Warta** adalah platform media sosial berbasis komunitas yang dirancang untuk membantu masyarakat melaporkan, memantau, dan mengikuti perkembangan proyek infrastruktur pemerintah.

Pengguna dapat membagikan informasi melalui unggahan berupa teks, foto, dan video. Pengguna lain juga dapat memberikan dukungan serta menambahkan bukti atau informasi pendukung. Dengan demikian, Warta bertujuan untuk meningkatkan transparansi, mendorong partisipasi publik, dan memperkuat akuntabilitas dalam pembangunan infrastruktur.

## Tech Stack

Proyek ini dibangun menggunakan teknologi berikut:

| Kategori | Teknologi |
|---|---|
| **Front-end** | ![Static Badge](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=white) ![Static Badge](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) |
| **Back-end** | ![Static Badge](https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white) ![Static Badge](https://img.shields.io/badge/Fiber-00ACD7?style=flat&logo=go&logoColor=white) |
| **Database** | ![Static Badge](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white) |

## Panduan Pengembangan

Ikuti langkah-langkah berikut untuk menjalankan Warta di lingkungan lokal.

### Persyaratan

Pastikan Anda telah memiliki aplikasi berikut:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- [NPM](https://www.npmjs.com/) atau [PNPM](https://pnpm.io/)
- [Go](https://go.dev/)
- [PostgreSQL](https://www.postgresql.org/)

### 1. Clone Repository

Buka terminal, kemudian jalankan perintah berikut untuk mengunduh repository:

```bash
git clone https://github.com/xernom-gt/WARTA.git
```

Setelah proses clone selesai, masuk ke direktori proyek:

```bash
cd WARTA
```

### 2. Menjalankan Front-end

#### 2.1. Install Dependencies

Sebelum menjalankan aplikasi, instal seluruh dependencies yang diperlukan menggunakan package manager pilihan Anda.

**NPM**
```bash
npm install
```

**PNPM**
```bash
pnpm install
```

#### 2.2. Menjalankan Development Server

Jalankan perintah berikut untuk memulai development server:

**NPM**
```bash
npm run dev
```

**PNPM**
```bash
pnpm dev
```

Setelah development server berhasil dijalankan, buka URL lokal yang ditampilkan pada terminal untuk mengakses aplikasi.

### 3. Menjalankan Back-end

> [!NOTE]
> Back-end saat ini baru memiliki fondasi autentikasi (register, login JWT, `/auth/me`). Endpoint katalog proyek, laporan, dan verifikasi masih menyusul — lihat `TASK.md` untuk daftar pekerjaan yang tersisa.

#### Persyaratan tambahan

- [Go 1.27+](https://go.dev/)
- [Docker](https://www.docker.com/) untuk database PostgreSQL

#### 3.1. Menjalankan Database

Dari folder root repository:

```bash
docker compose up -d db
```

Migrasi skema dijalankan otomatis oleh server saat start (`M1 Foundation: users`).

#### 3.2. Menjalankan API Server

Salin `.env.example` sebagai acuan, lalu set environment dan jalankan dari folder `api/`:

**PowerShell**

```powershell
$env:DATABASE_URL = "postgres://warta:warta@localhost:5433/warta?sslmode=disable"
$env:JWT_SECRET   = "<kunci-HS256-berupa-string-acak>"   # openssl rand -base64 48
$env:WARTA_SEED   = "1"                                  # opsional isi data dev (3 warga, password: warta-dev-2026)

cd api
go run .
```

**Bash**

```bash
export DATABASE_URL="postgres://warta:warta@localhost:5433/warta?sslmode=disable"
export JWT_SECRET="<kunci-HS256-berupa-string-acak>"
export WARTA_SEED=1  # opsional isi data dev

cd api
go run .
```

Server berjalan di `http://localhost:3000`. Kontrak lengkap ada di `docs/api/openapi.yaml`.

#### 3.3. Contoh Pemakaian

```bash
# Mendaftar
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"display_name":"warga_uji","email":"uji@example.com","password":"rahasia-aman"}'

# Login (mengembalikan access_token JWT, masa berlaku 3600 detik)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"uji@example.com","password":"rahasia-aman"}'

# Profil pribadi (Bearer token dari login)
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer <access_token>"
```

## Status Proyek

Warta saat ini masih berada dalam tahap awal pengembangan.

**Front-end**: antarmuka `landing/` dan `admin/` sudah berjalan, termasuk tampilan queue verifikasi dan profil warga.

**Back-end**: fondasi autentikasi sudah tersedia pada `api/` — register warga, login dengan JWT (HS256, 3600s), rate limiting, `X-Request-Id`, serta tabel `users` (migrasi M1). Endpoint katalog proyek, laporan, klaim lokasi, dan verifikasi menyusul sesuai urutan di `TASK.md`.
