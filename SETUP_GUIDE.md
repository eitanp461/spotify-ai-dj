# Quick Setup Guide 🚀

## Prerequisites
- Node.js 18+ installed
- Spotify Developer Account
- OpenAI API Key

## 1. Quick Setup
```bash
# Run the automated setup script
./setup.sh

# Or manually:
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## 2. Get Your API Keys

### Spotify API Setup
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in app details:
   - **App name**: Spotify AI DJ
   - **App description**: AI-powered playlist creator
   - **Redirect URI**: `http://127.0.0.1:3001/auth/spotify/callback`
4. Save your **Client ID** and **Client Secret**

### OpenAI API Setup
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

## 3. Configure Environment
```bash
# Copy the environment template
cp backend/env.example backend/.env

# Edit the .env file with your credentials
nano backend/.env  # or use your preferred editor
```

Required variables:
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
OPENAI_API_KEY=sk-your_openai_key_here
SESSION_SECRET=any_random_string_here
```

## 4. Run the Application
```bash
# Start both frontend and backend
npm run dev

# The app will be available at:
# Frontend: http://127.0.0.1:3000
# Backend: http://127.0.0.1:3001
```

## 5. Test the Application
1. Open http://127.0.0.1:3000
2. Click "Connect Spotify"
3. Authorize the app
4. Start chatting with the AI DJ!

## Troubleshooting

### Common Issues
- **"Missing environment variable"**: Make sure all variables in `.env` are set
- **"Redirect URI mismatch"**: Ensure your Spotify app has the correct redirect URI
- **"Invalid API key"**: Double-check your OpenAI API key format

### Getting Help
- Check the main [README.md](README.md) for detailed documentation
- Ensure all dependencies are installed: `npm run install:all`
- Verify TypeScript compilation: `cd backend && npm run type-check`

---

**Ready to create amazing playlists! 🎵** 