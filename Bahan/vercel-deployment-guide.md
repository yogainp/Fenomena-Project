# Panduan Deploy Fenomena App ke Vercel

## 📋 Checklist Deployment

### 1. Setup Environment Variables di Vercel Dashboard

1. Buka [vercel.com](https://vercel.com) dan login dengan GitHub
2. Pilih project **fenomena-app**
3. Masuk ke **Settings** → **Environment Variables**
4. Tambahkan satu per satu environment variables dari file `.env-production`:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres.abndwvxmpimfvhriqxuc:Passworddatabase2020%21@aws-0-ap-southeast-1.pooler.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1` | Production |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abndwvxmpimfvhriqxuc.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis` | Production |
| `JWT_SECRET` | `af0368841de62b80923c02d5492c710362c4077c8af00eed257e6f13c1b90e6b` | Production |
| `NEXTAUTH_SECRET` | `e479a7d3412baf6cac583b14cfeef844fb6f8d7215aba5b0f6b8c95768c33a98` | Production |
| `NEXTAUTH_URL` | `https://fenomena-project.vercel.app` | Production |

### 2. Configure Project Settings

1. Di **Settings** → **General**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `fenomena-app`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 3. Deploy Process

**Option A: Auto Deploy via GitHub** (Recommended)
1. Commit dan push code ke GitHub
2. Vercel akan auto-deploy karena GitHub integration sudah aktif
3. Monitor deployment di dashboard Vercel

**Option B: Manual Deploy via Dashboard**
1. Di project dashboard, klik **Deploy**
2. Pilih branch yang akan di-deploy
3. Wait for build process selesai

### 4. Post-Deployment Verification

1. **Check Build Logs**:
   - Pastikan no errors dalam build process
   - Verify semua environment variables loaded

2. **Test Application**:
   - Buka https://fenomena-project.vercel.app
   - Test login functionality
   - Verify database connection
   - Check Supabase integration

3. **Monitor Performance**:
   - Check response times
   - Monitor function execution
   - Review any runtime errors

### 5. Domain Configuration (Optional)

Jika ingin custom domain:
1. **Settings** → **Domains**
2. Add custom domain
3. Configure DNS records sesuai instruksi Vercel

### 6. Security Checklist

- ✅ Environment variables set via dashboard (tidak di-commit ke Git)
- ✅ Production secrets berbeda dari development
- ✅ Database credentials secure
- ✅ NEXTAUTH_URL sesuai production domain

### 7. Troubleshooting

**Common Issues:**
- **Build Failed**: Check build logs untuk error details
- **Environment Variables**: Pastikan semua required vars sudah di-set
- **Database Connection**: Verify DATABASE_URL dan network access
- **Supabase**: Check CORS settings untuk allow domain vercel

**Debugging Steps:**
1. Check function logs di Vercel dashboard
2. Verify environment variables di Settings
3. Test API endpoints individually
4. Review Supabase logs untuk database queries

## 🔒 Security Notes

- **JANGAN PERNAH** commit file `.env-production` ke Git
- Delete file `.env-production` setelah setup selesai
- Gunakan secrets yang berbeda untuk development vs production
- Monitor access logs dan unusual activities

## 📞 Support

Jika ada issue:
1. Check Vercel documentation: https://vercel.com/docs
2. Review build logs di dashboard
3. Check GitHub Actions jika ada automation
4. Contact support via Vercel dashboard

---
*Generated for Fenomena App Deployment - Vercel Integration*