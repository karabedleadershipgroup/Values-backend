# Values-Based Leadership Response Tool
**Karabed Leadership Group**

A trauma-informed, values-based AI coaching tool for social services leaders. Analyzes staff behavior situations and generates structured leadership responses grounded in six organizational values.

---

## Deploy to Vercel (step by step)

### 1. Push to GitHub

1. Create a new repository on [github.com](https://github.com)
2. In your terminal, from inside this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New Project**
3. Import your GitHub repository
4. Click **Deploy** (no build settings need to change)

### 3. Add your API key

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
3. Click **Save**, then go to **Deployments** and **Redeploy**

Your site is now live.

---

## Run locally

```bash
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Values covered

- Adaptability
- Client-Centered
- Collaboration
- DEIB
- Integrity
- Respect

---

## Built by
Karabed Leadership Group — [klg.com](https://klg.com)
