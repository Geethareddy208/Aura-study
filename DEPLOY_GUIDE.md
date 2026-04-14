# Aura Study - GitHub & Deployment Guide

This guide will help you create a repository on GitHub and push your code there.

## Step 1: Create a Repository on GitHub
1. Log in to [GitHub.com](https://github.com/).
2. Click the **"+"** icon in the top-right corner and select **"New repository"**.
3. Name it **`aura-study`**.
4. Keep it Public (or Private) and click **"Create repository"**.
5. Copy the URL of your new repository (it looks like `https://github.com/your-username/aura-study.git`).

## Step 2: Push your Code
Open your terminal in the project folder and run these commands one by one:

```bash
# 1. Configure Git (Only if you haven't before)
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

# 2. Add your files
git add .

# 3. Create your first commit
git commit -m "Initial commit - Aura Study Premium"

# 4. Connect to your GitHub repo (Replace YOUR_URL with the one you copied)
git remote add origin YOUR_URL

# 5. Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel
1. Go to [Vercel.com](https://vercel.com/) and sign up with GitHub.
2. Select your `aura-study` repository.
3. Click on the **"Environment Variables"** section and add these two:
   - `VITE_SUPABASE_URL`: `https://zabsekqtajqawoqwtqzb.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_2mFtRNzaRDIwu-gPlvVzD952XbYndW`
4. Click **Deploy**.

## Access
Once complete, you can open your app on any mobile device via the Vercel URL!
