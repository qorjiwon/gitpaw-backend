
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  FRONTEND_URL = 'https://pet-gotcha-garden.vercel.app/',
} = process.env;

const app = express();
app.use(cors({
  origin: [
    'http://localhost:8080',
    'https://pet-gotcha-garden.vercel.app'
  ],
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// 헬스체크용 라우트
app.get('/', (_req, res) => {
  res.send('OK');
});

// 1) GitHub OAuth 페이지로 리다이렉트
app.get('/auth/github', (_req, res) => {
  const redirectUri = 
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&scope=read:user`; 
  res.redirect(redirectUri);
});

// 2) GitHub에서 콜백 → 코드 교환 → 엑세스 토큰 발급
app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code as string;
  try {
    // 1) 토큰 교환
    const tokenResp = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' } }
    );
    const accessToken = tokenResp.data.access_token;

    // 2) (선택) 유저 정보 조회
    const userResp = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = userResp.data;

    // 3) 클라이언트로 리다이렉트 (여기에 추가)
    const params = new URLSearchParams({
      token: accessToken,
      login: githubUser.login,
    }).toString();
    res.redirect(`${FRONTEND_URL}/?${params}`);

  } catch (err) {
    console.error(err);
    res.status(500).send('GitHub OAuth Error');
  }
});

// 서버 시작
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`);
});