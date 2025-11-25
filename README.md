# The Last Paideia

A minimalist, secure video hosting platform for "The Last Paideia - The Regime of Quiet Hands".

## Features

- Password-protected video access
- Zero egress cost video streaming via Cloudflare R2
- Dark cinematic theme (Greek/South Indian/Lunar aesthetic)
- DDoS protection via Cloudflare
- Signed URLs prevent hotlinking
- Mobile responsive design

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare (Free)                       │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │  DNS + DDoS     │         │    R2 Storage           │   │
│  │  Protection     │         │    (Zero Egress)        │   │
│  └────────┬────────┘         └───────────┬─────────────┘   │
└───────────┼──────────────────────────────┼─────────────────┘
            │                              │
            ▼                              │
┌───────────────────────┐                  │
│  Railway (Express)    │                  │
│  - Password Auth      │───signed URL────▶│
│  - Session Mgmt       │                  │
│  - Rate Limiting      │                  │
└───────────────────────┘                  │
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
│   HTML/CSS/JS from Railway  │  Video streams from R2 CDN   │
└─────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| Cloudflare R2 (10GB free, zero egress) | $0 |
| Cloudflare DNS/CDN | $0 |
| Railway ($5 free credit) | $0 |
| **Total** | **$0** |

## Quick Start

### Prerequisites

- Node.js 18+
- A Cloudflare account (free)
- A Railway account (free tier)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/thelastpaideia.git
   cd thelastpaideia
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Generate a password hash:
   ```bash
   # Replace 'your-secret-password' with your desired password
   node -e "import('bcrypt').then(b => b.default.hash('your-secret-password', 12).then(console.log))"
   ```
   Copy the output and set it as `PASSWORD_HASH` in your `.env` file.

5. Generate a session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and set it as `SESSION_SECRET` in your `.env` file.

6. For local testing without R2, place a `video.mp4` file in the `public/` folder.

7. Start the development server:
   ```bash
   npm run dev
   ```

8. Visit `http://localhost:3000`

## Cloudflare R2 Setup

### Step 1: Create a Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free)
2. Add your domain (`thelastpaideia.com`) to Cloudflare
3. Update your domain's nameservers at your registrar to Cloudflare's

### Step 2: Create an R2 Bucket

1. In Cloudflare Dashboard, go to **R2** in the sidebar
2. Click **Create bucket**
3. Name it (e.g., `paideia-video`)
4. Leave settings as default, click **Create bucket**

### Step 3: Upload Your Video

1. Click on your bucket
2. Click **Upload** > **Upload file**
3. Select your video file (e.g., `the-last-paideia.mp4`)
4. Wait for upload to complete

Alternatively, use rclone for large files:
```bash
# Install rclone: https://rclone.org/install/
# Configure R2: https://developers.cloudflare.com/r2/examples/rclone/

rclone copy ./your-video.mp4 r2:paideia-video/the-last-paideia.mp4 --progress
```

### Step 4: Create R2 API Token

1. In R2, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Set permissions: **Object Read only** (for security)
4. Specify your bucket
5. Click **Create API Token**
6. **Save the credentials immediately** - they're only shown once!
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`

### Step 5: Get Your Account ID

1. Your Account ID is in the Cloudflare Dashboard URL:
   `https://dash.cloudflare.com/[ACCOUNT_ID]/...`
2. Or find it in the sidebar under **Account Home**
3. Copy it → `R2_ACCOUNT_ID`

## Railway Deployment

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js and deploys

### Step 3: Configure Environment Variables

In Railway Dashboard → Your Project → **Variables**:

| Variable | Value |
|----------|-------|
| `PASSWORD_HASH` | Your bcrypt hash |
| `SESSION_SECRET` | Random 32+ char string |
| `R2_ACCOUNT_ID` | From Cloudflare |
| `R2_ACCESS_KEY_ID` | From R2 API token |
| `R2_SECRET_ACCESS_KEY` | From R2 API token |
| `R2_BUCKET_NAME` | Your bucket name |
| `VIDEO_KEY` | `the-last-paideia.mp4` |
| `NODE_ENV` | `production` |

### Step 4: Set Spending Limit (Important!)

1. Go to **Settings** → **Usage**
2. Set a spending limit (e.g., $5/month)
3. This prevents any surprise bills

### Step 5: Connect Custom Domain

1. In Railway, go to **Settings** → **Domains**
2. Click **Add Custom Domain**
3. Enter `thelastpaideia.com`
4. Railway provides CNAME records
5. In Cloudflare DNS:
   - Add CNAME record pointing to Railway
   - **Enable the orange cloud (Proxy)** for DDoS protection

## Cloudflare Security Settings

### Enable Rate Limiting (Free)

1. In Cloudflare Dashboard → **Security** → **WAF**
2. Create a rule:
   - **If** URI path contains `/api/auth`
   - **Then** Rate limit: 10 requests per minute
   - **Action**: Block for 10 minutes

### Enable Bot Protection

1. Go to **Security** → **Bots**
2. Enable **Bot Fight Mode** (free)

## Making the Video Public

To remove password protection:

1. In Railway Variables, set:
   ```
   IS_PUBLIC=true
   ```

2. Redeploy (automatic)

3. The video is now publicly accessible

## Security Features

- **Password hashing**: bcrypt with cost factor 12
- **Session cookies**: HTTP-only, secure, SameSite
- **Rate limiting**: 10 auth attempts/minute per IP
- **Helmet.js**: Security headers (CSP, HSTS, etc.)
- **Signed URLs**: 1-hour expiry, prevents hotlinking
- **Cloudflare**: DDoS protection, bot mitigation

## Troubleshooting

### Video won't play
- Check browser console for errors
- Verify R2 credentials in Railway variables
- Ensure video filename matches `VIDEO_KEY`

### Password not working
- Regenerate password hash with same password
- Check for whitespace in environment variables

### Infinite loading
- Check Railway logs for errors
- Verify all R2 environment variables are set

### CORS errors
- Ensure Cloudflare proxy (orange cloud) is enabled
- Check CSP headers in `server.js`

## License

Private - All rights reserved

---

*The Last Paideia - The Regime of Quiet Hands*
