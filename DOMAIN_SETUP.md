# MMMMood Domain Setup Guide

## Domain Configuration Checklist

### ✅ Completed Steps:

1. **Supabase Authentication URLs** ✓
   - Added `https://www.mmmmood.com`
   - Added `https://mmmmood.com`
   - Added `https://www.mmmmood.com/*`
   - Added `https://mmmmood.com/*`

2. **Vercel Domain Setup** ✓
   - Primary domain: `mmmmood.com`
   - Redirect: `www.mmmmood.com` redirects to primary

3. **Parser Environment Files** ✓
   - Updated `.env`
   - Updated `.env.production`
   - Updated `.env.example`
   - Updated `FRONTEND_URL` to `https://www.mmmmood.com`

4. **Branding Updates** ✓
   - Changed "Bluestock" to "MMMMood" in:
     - dashboard.html (title and heading)
     - server.js (API messages)

5. **Supabase Storage Cleanup** ✓
   - Deleted 3,289 files (3GB) from old storage
   - All buckets cleared

---

## 🚨 Required Manual Steps:

### 1. Update Railway Environment Variables

Go to Railway dashboard and update the following environment variable:

```
FRONTEND_URL=https://www.mmmmood.com
```

**Steps:**
1. Go to https://railway.app
2. Click on your `bluestock-parser` project
3. Click on the service
4. Go to "Variables" tab
5. Find `FRONTEND_URL` and change it to `https://www.mmmmood.com`
6. Click "Deploy" to apply changes

---

### 2. Update Main Bluestock App

Go to `/Users/namu_1/bluestock` and update:

**Environment Variables (.env.local):**
```
NEXT_PUBLIC_API_URL=https://bluestock-parser.up.railway.app
NEXT_PUBLIC_SITE_URL=https://www.mmmmood.com
```

**Update any API calls or CORS configuration** that reference the old domain.

---

### 3. Cloudflare DNS (if not already done)

Make sure you have these DNS records:

**A Records (or CNAME to Vercel):**
- `mmmmood.com` → Points to Vercel
- `www.mmmmood.com` → Points to Vercel

**Redirect Rule (optional but recommended):**
- Create a redirect rule: `mmmmood.com/*` → `https://www.mmmmood.com/$1` (301 permanent)

---

### 4. Update CDN Configuration (Optional)

If you want to rebrand your Bunny CDN:

**Current:** `bluestock.b-cdn.net`
**To change:**
1. Go to BunnyCDN dashboard
2. Rename pull zone or create a new one
3. Update environment variables:
   ```
   BUNNY_PULL_ZONE_URL=mmmmood.b-cdn.net
   BUNNY_STORAGE_ZONE=mmmmood-assets
   ```

**Note:** This is optional - you can keep using `bluestock.b-cdn.net` if you prefer (it still works fine).

---

## Testing Your Domain

After completing the manual steps, test your domain:

### 1. Test Frontend
```bash
curl https://www.mmmmood.com
```

### 2. Test API
```bash
curl https://bluestock-parser.up.railway.app/test
```

### 3. Test CORS
Open your browser console on `https://www.mmmmood.com` and check for CORS errors.

---

## Summary

**What's Done:**
- ✅ Supabase configured with new domain
- ✅ Vercel configured (mmmmood.com → www.mmmmood.com)
- ✅ Parser code updated (Bluestock → MMMMood)
- ✅ Environment files updated
- ✅ Supabase storage cleaned (3GB freed)

**What You Need to Do:**
1. Update `FRONTEND_URL` in Railway dashboard
2. Update main app at `/Users/namu_1/bluestock`
3. Verify Cloudflare DNS is pointing correctly
4. (Optional) Rename BunnyCDN assets

---

## Rollback Plan

If something goes wrong, you can quickly rollback by:

1. Change Railway `FRONTEND_URL` back to `https://bluestock-bay.vercel.app`
2. Change Vercel domain back to original
3. Git revert this commit

---

## Questions?

- **Why www.mmmmood.com instead of mmmmood.com?**
  You configured Vercel to redirect from non-www to www, so we're using www as primary.

- **Do I need to update the CDN?**
  No, the CDN domain (`bluestock.b-cdn.net`) can stay the same. It's just a CDN URL, users won't see it.

- **Will old links break?**
  If you keep the old Vercel deployment active with a redirect, old links will redirect to the new domain.
