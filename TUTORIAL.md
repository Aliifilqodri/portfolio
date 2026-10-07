# Tutorial: dari ZIP sampai website live dengan admin

Alurnya: **kode di GitHub, database di MongoDB Atlas, website di Vercel.**
Isi website (proyek, foto, CV, dll) kamu input langsung dari websitenya setelah login.
Semua layanan di bawah punya paket gratis.

## Isi folder

```
index.html     tampilan website
api/           backend (login, simpan data, upload file)
package.json   daftar library
vercel.json    pengaturan
```

Kamu tidak perlu mengedit file apa pun. Semua isi website diisi lewat mode admin.

## Coba di laptop dulu (tanpa deploy, tanpa akun apa pun)

Tidak perlu MongoDB, GitHub, atau Vercel. Data tersimpan sementara di folder `.localdb` di laptopmu.

1. Install **Node.js** versi LTS dari https://nodejs.org, lalu restart komputer kalau perlu.
2. Ekstrak ZIP, buka VS Code, pilih **File > Open Folder** dan pilih folder `portfolio-fullstack`.
3. Buka terminal: menu **Terminal > New Terminal**.
4. Ketik perintah ini, tekan Enter, dan tunggu sampai selesai (cukup sekali):

   ```
   npm install
   ```

5. Jalankan website:

   ```
   npm start
   ```

6. Buka **http://localhost:3000** di browser.
7. Scroll ke paling bawah, klik **Login**, lalu masukkan password **admin12345**.
8. Coba klik tombol **+ Proyek**, isi, dan **Simpan**.
9. Berhenti dengan menekan **Ctrl+C** di terminal. Jalankan lagi dengan `npm start`, datamu masih ada.

Hal yang perlu diingat:
- **Jangan klik dua kali `index.html`.** Website harus dibuka lewat `http://localhost:3000`, karena bagian login dan simpan butuh server yang dijalankan `npm start`.
- Kalau PowerShell menolak dengan tulisan "running scripts is disabled", buka terminal lain: panah di samping tombol **+** pada panel terminal, pilih **Command Prompt**, lalu ulangi perintahnya.
- Mau mengulang dari kosong: hentikan server, hapus folder `.localdb`, lalu jalankan lagi.
- Mau mencoba dengan MongoDB sungguhan di laptop: salin `.env.example` menjadi `.env`, lalu isi `MONGODB_URI`, `ADMIN_PASSWORD`, dan `SESSION_SECRET`.
- Data di `.localdb` hanya ada di laptopmu, tidak ikut ke website yang sudah deploy. Setelah deploy, kamu mengisi ulang lewat mode admin.

## Tahap 1: MongoDB Atlas (database)

1. Daftar di https://www.mongodb.com/cloud/atlas lalu login.
2. Klik **Create** (atau **Build a Database**), pilih paket **M0 Free**.
   Provider **AWS**, region **Singapore**, lalu **Create**.
3. Buat **Database User**: isi username dan password. Pakai huruf dan angka saja (hindari simbol)
   supaya tidak error. **Catat keduanya.**
4. Buka **Network Access > Add IP Address > Allow Access From Anywhere** (0.0.0.0/0) > **Confirm**.
   Ini perlu karena alamat IP Vercel berubah-ubah.
5. Buka **Database > Connect > Drivers**. Salin connection string yang bentuknya:

   ```
   mongodb+srv://USERNAME:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   Ganti `<password>` (termasuk tanda `< >`) dengan password database user tadi. Simpan hasilnya.

## Tahap 2: Upload ke GitHub

1. Buat akun di https://github.com, lalu **New repository**, nama `portfolio`, pilih **Public**.
2. Klik **uploading an existing file**.
3. Ekstrak ZIP, buka folder `portfolio-fullstack`, **pilih semua isinya** (index.html,
   folder `api`, package.json, vercel.json, .gitignore), lalu tarik ke GitHub.
4. Klik **Commit changes**.

Pastikan `index.html` ada di halaman depan repo, dan folder `api` ikut terunggah beserta 7 file di dalamnya.
File yang namanya diawali titik (seperti `.gitignore`) kadang tidak ikut terpilih, dan itu tidak apa-apa.

## Tahap 3: Deploy di Vercel

1. Buka https://vercel.com, login dengan GitHub.
2. **Add New > Project**, pilih repo `portfolio`, **Import**.
3. **Sebelum klik Deploy**, buka bagian **Environment Variables** dan tambahkan 3 variabel:

| Name | Value |
|---|---|
| `MONGODB_URI` | connection string dari Tahap 1 (password sudah diganti) |
| `ADMIN_PASSWORD` | password admin yang kamu pilih, minimal 12 karakter |
| `SESSION_SECRET` | teks acak panjang apa saja, misalnya 40 huruf dan angka |

4. Klik **Deploy**, tunggu sekitar 1 menit.

Kalau kamu lupa mengisi variabel sebelum deploy: **Project > Settings > Environment Variables**,
tambahkan, lalu **Deployments > titik tiga > Redeploy**.

## Tahap 4: Login dan isi website langsung dari halamannya

1. Buka alamat websitemu. Tampilannya kosong, seperti yang dilihat pengunjung.
2. Scroll ke paling bawah, klik **Login** di footer, lalu masukkan `ADMIN_PASSWORD`.
3. Setelah masuk, muncul bar hitam **MODE ADMIN** di bawah layar, dan tombol di tiap bagian halaman:
   **Edit profil & foto** (paling atas), **Edit tentang**, **+ Statistik**, **+ Skill**, **Edit tools**,
   **+ Proyek**, **+ Pencapaian**, **+ Pengalaman**, **Edit CV**, **+ Testimoni**, **Edit kontak**, dan **Edit Tally**.
4. Klik tombolnya, isi formulir (judul, deskripsi, tahun, link). Untuk foto, GIF, dan CV klik **Choose File**,
   tunggu preview muncul, lalu klik **Simpan**. Perubahan langsung tersimpan dan tampil.
5. Item yang sudah ada punya tombol **Edit**, **↑**, dan **↓** (urutan). Tombol **Hapus** ada di dalam jendela Edit.
6. Selesai? Klik **Keluar** di bar hitam. Pengunjung biasa tidak melihat tombol apa pun selain **Login** kecil di footer.

Foto otomatis dikecilkan. **GIF dan PDF maksimal 3 MB**. Bagian yang masih kosong tidak tampil untuk pengunjung.

### Ganti password

Klik **Ganti password** di bar admin, isi password lama dan baru (minimal 10 karakter).
Password baru tersimpan di database dan menggantikan `ADMIN_PASSWORD` dari Vercel.

Lupa password? Buka MongoDB Atlas, **Database > Browse Collections > portfolio > settings**,
hapus dokumen `admin`. Setelah itu password kembali ke `ADMIN_PASSWORD` di Vercel.
Untuk mengeluarkan semua sesi login yang sedang aktif, ganti `SESSION_SECRET` di Vercel lalu Redeploy.

## Tahap 5: Form pesan dan testimoni (Tally)

1. Daftar di https://tally.so, buat form pesan (Nama, Email, Pesan) dan form testimoni (Nama, Jabatan, Isi).
2. Di tiap form buka **Integrations > Email notifications**, isi emailmu.
3. **Publish**. ID form adalah bagian setelah `tally.so/r/`, misalnya `mYz4Ab`.
4. Login, klik **Edit Tally** di bagian Kontak, isi ID-nya, lalu **Simpan**.

Testimoni yang masuk lewat Tally tidak langsung tampil. Setelah masuk ke emailmu, tambahkan yang layak
lewat mode admin di tab **Testimoni**. Itu sengaja, supaya kamu bisa menyaring spam.
Kalau jumlahnya lebih dari batas per halaman, tombol halaman muncul otomatis.

## Kalau ada masalah

| Gejala | Biasanya karena |
|---|---|
| Tombol Login tidak muncul | Deploy belum selesai, atau browser menyimpan versi lama (tekan Ctrl+F5) |
| Login selalu "Password salah" | `ADMIN_PASSWORD` belum diisi, atau lupa Redeploy setelah mengisinya |
| Gagal menyimpan atau "Server error" | `MONGODB_URI` salah: password belum diganti, atau Network Access belum 0.0.0.0/0 |
| Foto atau CV gagal diunggah | File lebih dari 3 MB, atau bukan JPG, PNG, WEBP, GIF, atau PDF |
| Website masih kosong setelah simpan | Tunggu beberapa detik lalu refresh (Ctrl+F5) |

Untuk melihat pesan error aslinya: **Vercel > Project > Logs**.

## Keamanan

- Jangan membagikan `ADMIN_PASSWORD` dan `MONGODB_URI` ke siapa pun, dan jangan menuliskannya di file kode.
- Gunakan password admin yang panjang dan unik, karena tombol Login terlihat oleh umum (hanya dikunci password).
- Sesi login berlaku 7 hari. Klik **Keluar** kalau memakai komputer orang lain.
- File yang dihapus dari daftar tidak terhapus dari database (hanya tidak dipakai lagi).
  Paket gratis MongoDB 512 MB cukup untuk puluhan foto.

## Domain sendiri (opsional)

Beli domain, lalu di Vercel buka **Settings > Domains**, tambahkan, dan ikuti instruksi DNS.
