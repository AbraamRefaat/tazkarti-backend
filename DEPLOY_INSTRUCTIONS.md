# 🚀 Deploy to Vercel

Follow these simple steps to deploy your Tazkarti backend.

---

## Step 1: Upload to GitHub

### Option A: Using GitHub Web (Easiest)

1. Go to https://github.com
2. Click **"New repository"**
3. Repository name: `tazkarti-backend`
4. Description: `Tazkarti events backend API`
5. Choose **Public** or **Private**
6. **DO NOT** check any boxes (no README, no .gitignore, no license)
7. Click **"Create repository"**
8. On the next page, click **"uploading an existing file"**
9. Drag and drop ALL files from `C:\tazkarti-backend\` folder
   - Make sure to include the `api` folder!
   - Include hidden files: `.gitignore`, `.vercelignore`
10. Click **"Commit changes"**

### Option B: Using Git Command Line

```bash
# Open terminal in C:\tazkarti-backend
cd C:\tazkarti-backend

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Tazkarti backend for Vercel"

# Add your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/tazkarti-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Vercel

### Method 1: Web Interface (Recommended)

1. Go to https://vercel.com
2. Click **"Sign Up"** → Choose **"Continue with GitHub"**
3. After login, click **"Add New..."** → **"Project"**
4. You'll see your GitHub repositories
5. Find **"tazkarti-backend"** and click **"Import"**
6. Configuration (leave defaults):
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: (empty)
   - Output Directory: (empty)
   - Install Command: `npm install`
7. Click **"Deploy"**
8. Wait 2-3 minutes ⏳

### Method 2: CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to folder
cd C:\tazkarti-backend

# Deploy
vercel

# Follow prompts and choose:
# - Set up and deploy: Y
# - Which scope: (your account)
# - Link to existing project: N
# - Project name: tazkarti-backend
# - Directory: ./ (press Enter)
# - Override settings: N
```

---

## Step 3: Get Your URL

After deployment:

1. You'll see: **"✅ Deployment Complete"**
2. Your URL will be displayed, like:
   ```
   https://tazkarti-backend.vercel.app
   ```
   or
   ```
   https://tazkarti-backend-username.vercel.app
   ```
3. **Copy this URL!** You'll need it for Flutter app.

---

## Step 4: Test Your API

Open your Vercel URL in browser with `/api/events/music`:

```
https://your-project.vercel.app/api/events/music
```

You should see JSON response with events! ✅

Example:
```json
{
  "success": true,
  "cached": false,
  "count": 4,
  "events": [...]
}
```

---

## Step 5: Update Flutter App

Go back to your Flutter project:

**File:** `c:\mobile-flutter\lib\services\server_config_tazkarti.dart`

Update this line:
```dart
static const String productionUrl = 'https://tazkarti-backend.vercel.app';
```

Replace with YOUR Vercel URL!

---

## Step 6: Run Flutter App

```bash
cd c:\mobile-flutter
flutter run
```

Open Home screen → Scroll to "Upcoming Events"  
Events should load from Vercel! 🎉

---

## ✅ Success Checklist

- [ ] Created GitHub repository `tazkarti-backend`
- [ ] Uploaded all files to GitHub
- [ ] Created Vercel account
- [ ] Imported repository to Vercel
- [ ] Deployment successful (green checkmark)
- [ ] Tested API URL in browser (shows JSON)
- [ ] Updated Flutter app with Vercel URL
- [ ] Ran Flutter app
- [ ] Events load on Home screen

---

## 🔄 Future Updates

When you need to update the backend:

1. Edit files in `C:\tazkarti-backend\`
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Update backend"
   git push
   ```
3. Vercel automatically redeploys! ✨

---

## 🆘 Troubleshooting

### Can't see .gitignore or .vercelignore files

These are hidden files. In File Explorer:
1. View → Options → View tab
2. Select "Show hidden files"
3. Uncheck "Hide extensions"

### Deployment failed on Vercel

1. Check Vercel dashboard → Logs
2. Common issues:
   - Missing dependencies → Check `package.json`
   - Wrong file structure → Ensure `api/events.js` exists

### Events not loading in Flutter

1. Test API directly in browser first
2. Check Flutter console for errors
3. Verify URL in `server_config_tazkarti.dart` matches Vercel URL
4. Make sure there are no typos

---

## 💰 Costs

**Vercel Free Tier:**
- 100GB bandwidth/month
- 100 hours execution/month
- Your usage: ~1-2GB/month

**Cost: $0** (well within free tier!) ✅

---

## 📞 Support

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Docs: https://vercel.com/docs
- Check deployment logs for errors

---

## 🎉 Congratulations!

Your Tazkarti backend is now live on Vercel and automatically scraping events!

No manual server starting needed! 🚀
