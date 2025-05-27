import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

//— Env check —
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  FRONTEND_URL,
} = process.env;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !FRONTEND_URL) {
  console.error(
    '❌ Missing required env vars. Please set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and FRONTEND_URL.'
  );
  process.exit(1);
}

const app = express();

// — 0) Health check (prevents 503 “Preparing”) —
app.get('/', (_req: Request, res: Response) => {
  res.send('OK');
});

// — 1) CORS for your SPA API calls —
app.use(
  cors({
    origin: [
      'http://localhost:8080',
      'https://pet-gotcha-garden.vercel.app',
      FRONTEND_URL,
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// — 2) Redirect into GitHub’s OAuth page —
app.get(
  '/auth/github',
  (_req: Request, res: Response): void => {
    const redirectUri = encodeURIComponent(
      `${FRONTEND_URL.replace(/\/$/, '')}/auth/github/callback`
    );
    const url =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${GITHUB_CLIENT_ID}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=read:user`;
    res.redirect(url);
  }
);

// — 3) Handle GitHub’s callback, fetch token & user, then forward to your front end —
app.get(
  '/auth/github/callback',
  async (req: Request, res: Response): Promise<void> => {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).send('Missing code parameter.');
      return;
    }

    try {
      // ⇢ Exchange code for access token
      const tokenResp = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id:     GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        },
        { headers: { Accept: 'application/json' } }
      );

      const accessToken = tokenResp.data.access_token as string | undefined;
      if (!accessToken) {
        throw new Error('No access token received from GitHub.');
      }

      // ⇢ (Optional) Get GitHub user profile
      const userResp = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const githubUser = userResp.data;

      // ⇢ Build query string and redirect back to your SPA
      const params = new URLSearchParams({
        token: accessToken,
        login: githubUser.login,
      }).toString();

      res.redirect(`${FRONTEND_URL.replace(/\/$/, '')}/?${params}`);
    } catch (err: any) {
      console.error('🔴 GitHub OAuth error:', err.response?.data || err.message);
      res.status(500).send('GitHub OAuth Error');
    }
  }
);

// — Start listening —
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Auth server listening on http://localhost:${PORT}`);
});