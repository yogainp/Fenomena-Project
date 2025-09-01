# Panduan Deployment Fenomena App ke cPanel

## Persiapan Sebelum Deploy

### 1. Informasi yang Dibutuhkan cPanel
- **Node.js Version:** 18.x atau 20.x (recommended)
- **Application Mode:** Production
- **NODE_ENV:** production
- **Application Root:** `/home/username/public_html` atau subdirectory
- **Application URL:** `https://yourdomain.com`
- **Application Startup File:** `server.js`
- **Passenger Log File:** `/home/username/logs/passenger.log`

## Langkah-Langkah Deployment

### 1. Build Aplikasi untuk Production

```bash
# Install dependencies
npm install

# Build aplikasi
npm run build
```

### 2. Konfigurasi Environment Variables

Edit file `.env.production` dan sesuaikan dengan environment production Anda:

```env
# Database - Ganti dengan URL database production
DATABASE_URL="postgresql://your-production-db-url"

# JWT & Auth - WAJIB diganti untuk keamanan
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-2024"
NEXTAUTH_SECRET="your-production-nextauth-secret-change-this"
NEXTAUTH_URL="https://yourdomain.com"

# Environment
NODE_ENV="production"
PORT=3000
```

### 3. Files yang Harus di Upload ke cPanel

Upload folder/files berikut ke Application Root di cPanel:

```
fenomena-app/
├── .next/               # Build output (setelah npm run build)
├── public/              # Static assets
├── node_modules/        # Dependencies (atau install di server)
├── src/                 # Source code
├── server.js            # Startup file ✓
├── package.json         # Dependencies info ✓
├── package-lock.json    # Lock file
├── next.config.ts       # Next.js config ✓
├── .env.production      # Environment variables ✓
├── tsconfig.json        # TypeScript config
└── middleware.ts        # Next.js middleware
```

### 4. Konfigurasi cPanel Node.js App

1. **Masuk ke cPanel → Node.js App**
2. **Create Application** dengan settings:
   - **Node.js Version:** 18.x atau 20.x
   - **Application Mode:** Production
   - **Application Root:** `/home/username/public_html/fenomena-app`
   - **Application URL:** `https://yourdomain.com`
   - **Application Startup File:** `server.js`

3. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=your-production-database-url
   JWT_SECRET=your-production-jwt-secret
   NEXTAUTH_SECRET=your-production-nextauth-secret
   NEXTAUTH_URL=https://yourdomain.com
   ```

4. **Passenger Log File:**
   ```
   /home/username/logs/passenger.log
   ```

### 5. Install Dependencies di Server

Setelah upload, di terminal cPanel atau File Manager:

```bash
cd /home/username/public_html/fenomena-app
npm install --production
```

### 6. Start Aplikasi

Dari cPanel Node.js App interface, klik **"Start"** atau gunakan terminal:

```bash
npm run cpanel:start
```

## Troubleshooting

### Masalah Umum

1. **Port sudah digunakan:**
   - Ganti PORT di environment variables
   - Restart aplikasi

2. **Database connection error:**
   - Pastikan DATABASE_URL benar
   - Check firewall/whitelist IP

3. **Build failed:**
   - Pastikan semua dependencies terinstall
   - Check Node.js version compatibility

4. **Puppeteer/Chromium issues:**
   - Aplikasi sudah dikonfigurasi untuk handle ini
   - Jika masih error, contact hosting support

### File Permissions

Pastikan file permissions benar:
```bash
chmod 644 *.js *.json *.ts *.md
chmod 755 server.js
chmod -R 755 .next/
chmod -R 755 public/
```

## Monitoring

### Logs Location
- **Passenger Logs:** `/home/username/logs/passenger.log`
- **Application Logs:** Check cPanel Node.js App interface

### Health Check
- Akses aplikasi via browser
- Check API endpoints: `/api/test`
- Monitor error logs

## Maintenance

### Update Aplikasi
1. Build baru di local: `npm run build`
2. Upload files yang berubah
3. Restart aplikasi dari cPanel

### Database Updates
- Pastikan migrasi database sudah berjalan
- Backup database sebelum update

## Security Checklist

- ✅ JWT_SECRET sudah diganti
- ✅ NEXTAUTH_SECRET sudah diganti
- ✅ Database credentials aman
- ✅ .env.production tidak di-commit ke git
- ✅ File permissions benar
- ✅ SSL certificate aktif

## Scripts Available

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm run start

# cPanel specific scripts
npm run cpanel:build    # Build untuk cPanel
npm run cpanel:start    # Start di cPanel
```

## Contact

Jika ada masalah deployment, check:
1. cPanel error logs
2. Node.js app status di cPanel
3. Database connectivity
4. DNS settings