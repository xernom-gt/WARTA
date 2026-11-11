BEGIN;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000001',
    '10091309000',
    'Rusun Rorotan IX Tahap I',
    'Dinas Perumahan Rakyat dan Kawasan Permukiman Provinsi DKI Jakarta',
    'Gedung & Permukiman',
    516020000000.00,
    476700000000.00,
    468350000000.00,
    NULL,
    'Jakarta Utara',
    false,
    'Rorotan, Kec. Cilincing, Jakarta Utara',
    'kabupaten/kota',
    'SPSE',
    false,
    'menunggu',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000001', 2025),
    ('11111111-1111-1111-1111-000000000001', 2026),
    ('11111111-1111-1111-1111-000000000001', 2027)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000001', 'Area Rusun Rorotan IX', 'Rorotan, Kec. Cilincing, Jakarta Utara', 'Jakarta Utara', 'kabupaten/kota', 'SPSE', -6.147200, 106.953100, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000001', 'rf-1', 'Kontrak 98,2% dari HPS', 'Nilai kontrak Rp468,35 miliar mendekati HPS Rp476,70 miliar.', 'info')
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000002',
    '10097213000',
    'Polder Kamal Tahap I',
    'Dinas Sumber Daya Air Provinsi DKI Jakarta',
    'Drainase & Pengendali Banjir',
    472940000000.00,
    437190000000.00,
    NULL,
    'Nilai kontrak belum tersedia di sumber publik.',
    'Jakarta Utara',
    false,
    'Jakarta Utara',
    'kabupaten/kota',
    'SPSE',
    false,
    'menunggu',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000002', 2025),
    ('11111111-1111-1111-1111-000000000002', 2026),
    ('11111111-1111-1111-1111-000000000002', 2027)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000002', 'Wilayah Polder Kamal', 'Jakarta Utara', 'Jakarta Utara', 'kabupaten/kota', 'SPSE', -6.098400, 106.718900, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO project_tenders (project_id, spse_code, status, note) VALUES
    ('11111111-1111-1111-1111-000000000002', '10089616000', 'Tender Gagal', 'Percobaan tender sebelumnya gagal dan diulang melalui kode tender 10097213000.')
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000002', 'rf-2a', 'Tender Ulang (Riwayat Gagal)', 'Dua baris tender digabung menjadi satu proyek unik (10089616000 gagal, 10097213000 tender ulang).', 'warning'),
    ('11111111-1111-1111-1111-000000000002', 'rf-2b', 'Kontrak Belum Tersedia', 'Nilai kontrak belum dipublikasikan di sumber SPSE.', 'info')
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    precision_resolution_note, status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000003',
    '10044987000',
    'UILS Koja',
    'Suku Dinas Sosial Kota Administrasi Jakarta Utara',
    'Gedung Layanan Sosial',
    1310000000.00,
    1310000000.00,
    1050000000.00,
    NULL,
    'Jakarta Utara',
    false,
    'Jl. Persahabatan No.13-14, Tugu Utara, Kec. Koja, Jakarta Utara',
    'alamat/ruas',
    'SPSE',
    false,
    'Baris kontrak (10044987000) hanya menulis "Sudin Sosial Jakarta Utara" (tingkat kota). Sistem otomatis memakai alamat paling presisi dari baris tender gagal.',
    'terverifikasi',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000003', 2025)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000003', 'Gedung UILS Koja', 'Jl. Persahabatan No.13-14, Tugu Utara, Kec. Koja, Jakarta Utara', 'Jakarta Utara', 'alamat/ruas', 'SPSE', -6.121400, 106.901200, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO project_tenders (project_id, spse_code, status, note) VALUES
    ('11111111-1111-1111-1111-000000000003', '10028401000', 'Tender Gagal', 'Memuat alamat presisi: Jl. Persahabatan No.13-14, Tugu Utara, Kec. Koja'),
    ('11111111-1111-1111-1111-000000000003', '10017232000', 'Tender Gagal', 'Memuat alamat presisi: Jl. Persahabatan No.13-14, Tugu Utara, Kec. Koja')
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000003', 'rf-3a', 'HPS Sama Persis dengan Pagu', 'Nilai Pagu dan HPS sama-sama Rp1,31 miliar.', 'warning'),
    ('11111111-1111-1111-1111-000000000003', 'rf-3b', '2x Gagal Tender Sebelumnya', 'Mengalami dua kali gagal tender sebelum berkontrak.', 'warning')
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000004',
    '10069030000',
    'IPAS TPST Bantargebang',
    'Unit Pengelola Sampah Terpadu Dinas Lingkungan Hidup DKI Jakarta',
    'Instalasi Pengolahan Air Sampah',
    12580000000.00,
    12440000000.00,
    9950000000.00,
    NULL,
    'Bekasi',
    true,
    'Jl. Pangkalan V, Kel. Ciketing Udik, Kec. Bantargebang, Bekasi',
    'desa/kelurahan',
    'warga',
    true,
    'menunggu',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000004', 2025)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000004', 'Area IPAS TPST Bantargebang', 'Jl. Pangkalan V, Kel. Ciketing Udik, Kec. Bantargebang, Bekasi', 'Bekasi', 'desa/kelurahan', 'warga', -6.342100, 106.998300, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO project_tenders (project_id, spse_code, status, note) VALUES
    ('11111111-1111-1111-1111-000000000004', '10055229000', 'Tender Gagal', 'Percobaan pertama gagal sebelum diulang pada kode 10069030000.')
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000004', 'rf-4', 'Lokasi Fisik di Luar DKI (Bekasi)', 'Proyek APBD DKI Jakarta yang berlokasi di Kel. Ciketing Udik, Bantargebang, Bekasi.', 'info')
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000005',
    '59676127',
    'NCICD Fase A Lokasi 1 Paket 2',
    'Dinas Sumber Daya Air Provinsi DKI Jakarta',
    'Tanggul Pesisir Pantai',
    276280000000.00,
    273930000000.00,
    252700000000.00,
    NULL,
    'Jakarta Utara',
    false,
    'Jakarta Utara',
    'kabupaten/kota',
    'SPSE',
    false,
    'terverifikasi',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000005', 2024),
    ('11111111-1111-1111-1111-000000000005', 2025)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000005', 'Tanggul Muara Baru', 'Jakarta Utara', 'Jakarta Utara', 'kabupaten/kota', 'SPSE', -6.102500, 106.801400, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000006',
    '10027666000',
    'Rehab Total Gedung Sekolah 2025 Paket 3',
    'Dinas Pendidikan Provinsi DKI Jakarta',
    'Gedung Sekolah',
    349040000000.00,
    345640000000.00,
    NULL,
    'Nilai kontrak belum tersedia di sumber publik.',
    'Jakarta Selatan',
    false,
    '5 titik lokasi di Jakarta Selatan (6 sekolah)',
    'kabupaten/kota',
    'SPSE',
    false,
    'menunggu',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000006', 2025)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000006', 'SDN Tebet Timur 07 (Pusat Paket)', '5 titik lokasi di Jakarta Selatan (6 sekolah)', 'Jakarta Selatan', 'kabupaten/kota', 'SPSE', -6.239400, 106.852300, false, true),
    ('11111111-1111-1111-1111-000000000006', 'SDN Cipete Utara 01', 'Cipete Utara, Kec. Kebayoran Baru', 'Jakarta Selatan', 'alamat/ruas', 'SPSE', -6.255000, 106.802000, true, false),
    ('11111111-1111-1111-1111-000000000006', 'SDN Setiabudi 01 & SMPN 58', 'Kec. Setiabudi (2 Sekolah 1 Lokasi)', 'Jakarta Selatan', 'kecamatan', 'SPSE', -6.212000, 106.829000, true, false)
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000006', 'rf-6', '1 Paket Mencakup 5 Lokasi (;)', 'Satu paket pengadaan menggabungkan 6 gedung sekolah di 5 titik berbeda di Jakarta Selatan.', 'info')
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000007',
    '52764127',
    'Jakarta Sewerage Zone 1 Paket 5 (Area 2-1)',
    'Dinas Sumber Daya Air Provinsi DKI Jakarta',
    'Jaringan Perpipaan Air Limbah',
    1160000000000.00,
    907900000000.00,
    787170000000.00,
    NULL,
    'Jakarta Pusat & Jakarta Barat',
    false,
    'Menteng, Gambir, Sawah Besar (Jakarta Pusat); Tamansari (Jakarta Barat)',
    'desa/kelurahan',
    'SPSE',
    false,
    'terverifikasi',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000007', 2022),
    ('11111111-1111-1111-1111-000000000007', 2023),
    ('11111111-1111-1111-1111-000000000007', 2024),
    ('11111111-1111-1111-1111-000000000007', 2025),
    ('11111111-1111-1111-1111-000000000007', 2026)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000007', 'Area Sewerage Gambir/Menteng', 'Menteng, Gambir, Sawah Besar (Jakarta Pusat); Tamansari (Jakarta Barat)', 'Jakarta Pusat', 'desa/kelurahan', 'SPSE', -6.194400, 106.822900, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000007', 'rf-7', 'Multi-Tahun Ekstrem (5 Tahun)', 'Didanai lintas 5 tahun anggaran (2022–2026) dan melintasi 2 kota administrasi.', 'info')
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000008',
    '10063530000',
    'Gapura Kepulauan Seribu',
    'Kabupaten Administrasi Kepulauan Seribu',
    'Ornamen & Fasilitas Wilayah',
    880420000.00,
    842100000.00,
    NULL,
    'Nilai kontrak belum tersedia di sumber publik.',
    'Kepulauan Seribu',
    false,
    'Pulau Pramuka, Kepulauan Seribu',
    'kabupaten/kota',
    'SPSE',
    false,
    'menunggu',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000008', 2025)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000008', 'Dermaga Pulau Pramuka', 'Pulau Pramuka, Kepulauan Seribu', 'Kepulauan Seribu', 'kabupaten/kota', 'SPSE', -5.745900, 106.613800, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000009',
    '10078924000',
    'Revitalisasi Trotoar & Saluran Koridor Sudirman-Thamrin',
    'Dinas Bina Marga Provinsi DKI Jakarta',
    'Jalan & Jembatan',
    125500000000.00,
    118200000000.00,
    114800000000.00,
    NULL,
    'Jakarta Pusat',
    false,
    'Jl. Jenderal Sudirman, Gelora, Tanah Abang, Jakarta Pusat',
    'titik',
    'SPSE',
    true,
    'selesai',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000009', 2025),
    ('11111111-1111-1111-1111-000000000009', 2026)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000009', 'Koridor Sudirman-Thamrin', 'Jl. Jenderal Sudirman, Gelora, Tanah Abang, Jakarta Pusat', 'Jakarta Pusat', 'titik', 'SPSE', -6.215400, 106.821100, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO projects (
    id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
    city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
    status, source_note
) VALUES (
    '11111111-1111-1111-1111-000000000010',
    '10065432000',
    'Pembangunan Flyover Pramuka-Matraman',
    'Dinas Bina Marga Provinsi DKI Jakarta',
    'Jalan & Jembatan',
    210000000000.00,
    198500000000.00,
    192100000000.00,
    NULL,
    'Jakarta Timur',
    false,
    'Simpang Matraman, Palmeriam, Matraman, Jakarta Timur',
    'titik',
    'SPSE',
    true,
    'terverifikasi',
    'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_years (project_id, fiscal_year) VALUES
    ('11111111-1111-1111-1111-000000000010', 2025),
    ('11111111-1111-1111-1111-000000000010', 2026)
ON CONFLICT DO NOTHING;

INSERT INTO project_locations (project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary) VALUES
    ('11111111-1111-1111-1111-000000000010', 'Simpang Matraman', 'Simpang Matraman, Palmeriam, Matraman, Jakarta Timur', 'Jakarta Timur', 'titik', 'SPSE', -6.202300, 106.858400, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO project_risk_flags (project_id, code, label, description, level) VALUES
    ('11111111-1111-1111-1111-000000000010', 'rf-10', 'Proyek Strategis Daerah', 'Pembangunan overpass untuk mengurai kemacetan koridor Matraman-Salemba.', 'info')
ON CONFLICT DO NOTHING;

COMMIT;
