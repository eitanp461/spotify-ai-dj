# Spotify AI DJ 🎵🤖

A modern web application that creates personalized Spotify playlists using AI. Chat with an AI DJ assistant to describe your mood, activity, or preferences, and get a custom playlist created directly in your Spotify account.

## Features

- 🎯 **AI-Powered Curation**: Chat with an intelligent AI DJ that understands your musical preferences
- 🎵 **Spotify Integration**: Seamlessly creates playlists directly in your Spotify account
- 🔐 **Secure OAuth**: Safe and secure Spotify authentication
- 💬 **Interactive Chat**: Natural conversation flow to understand your musical needs
- 🎨 **Modern UI**: Beautiful, responsive design with Spotify's design language
- ⚡ **Real-time**: Instant playlist creation and feedback

## Tech Stack

### Backend
- **Node.js** with **Express.js**
- **TypeScript** for type safety
- **Spotify Web API SDK** for Spotify integration
- **OpenAI API** for AI chat functionality
- **Express Session** for authentication management

### Frontend
- **React 18** with **TypeScript**
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Query** for state management and API calls
- **React Router** for navigation
- **Lucide React** for icons

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** installed
2. **npm** or **yarn** package manager
3. **Spotify Developer Account** - [Create one here](https://developer.spotify.com/dashboard)
4. **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd spotify-ai-dj
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 3. Spotify App Configuration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add these redirect URIs:
   - `http://127.0.0.1:3001/auth/spotify/callback` (for development)
   - Your production callback URL (for production)
4. Note down your **Client ID** and **Client Secret**

### 4. Environment Configuration

Create a `.env` file in the `backend` directory:

```bash
cp backend/env.example backend/.env
```

Edit `backend/.env` with your credentials:

```env
# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here

# URLs
FRONTEND_URL=http://127.0.0.1:3000
BACKEND_URL=http://127.0.0.1:3001

# Environment
NODE_ENV=development

# Server Port
PORT=3001
```

### 5. Run the Application

```bash
# Start both frontend and backend in development mode
npm run dev

# Or start them separately:
npm run dev:backend  # Starts backend on port 3001
npm run dev:frontend # Starts frontend on port 3000
```

The application will be available at:
- **Frontend**: http://127.0.0.1:3000
- **Backend**: http://127.0.0.1:3001

## How It Works

1. **Connect Spotify**: Users authenticate with their Spotify account using OAuth 2.0
2. **Chat with AI**: Users describe their musical preferences, mood, or activity
3. **AI Processing**: OpenAI analyzes the conversation and suggests appropriate songs
4. **Playlist Creation**: The app searches Spotify for the suggested tracks and creates a playlist
5. **Instant Access**: Users get a direct link to their new playlist in Spotify

## API Endpoints

### Authentication
- `GET /auth/spotify/login` - Initiate Spotify OAuth
- `GET /auth/spotify/callback` - Handle OAuth callback
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout user

### User & Playlist
- `GET /api/user` - Get current user profile
- `POST /api/chat` - Chat with AI DJ
- `POST /api/create-playlist` - Create playlist from AI suggestions

### Health
- `GET /health` - Health check endpoint

## Project Structure

```
spotify-ai-dj/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   └── index.ts        # Main server file
│   ├── package.json
│   ├── tsconfig.json
│   └── env.example
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── package.json            # Root package.json (workspace)
└── README.md
```

## Development

### Available Scripts

```bash
# Development
npm run dev                 # Start both frontend and backend
npm run dev:frontend        # Start only frontend
npm run dev:backend         # Start only backend

# Building
npm run build              # Build both frontend and backend
npm run build:frontend     # Build only frontend
npm run build:backend      # Build only backend

# Type checking
cd frontend && npm run type-check
cd backend && npm run type-check
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | Yes |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `SESSION_SECRET` | Random string for session encryption | Yes |
| `FRONTEND_URL` | Frontend URL (default: http://127.0.0.1:3000) | No |
| `BACKEND_URL` | Backend URL (default: http://127.0.0.1:3001) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `PORT` | Backend port (default: 3001) | No |

## Deployment

### Backend Deployment
1. Build the backend: `cd backend && npm run build`
2. Set production environment variables
3. Start with: `npm start`

### Frontend Deployment
1. Build the frontend: `cd frontend && npm run build`
2. Serve the `dist` folder with any static file server

### Environment Setup for Production
- Update `FRONTEND_URL` and `BACKEND_URL` to your production URLs
- Set `NODE_ENV=production`
- Use a secure `SESSION_SECRET`
- Update Spotify app redirect URIs to include your production callback URL

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/) for music data
- [OpenAI](https://openai.com/) for AI capabilities
- [Spotify Web API TypeScript SDK](https://github.com/spotify/spotify-web-api-ts-sdk) for easy Spotify integration

## Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Include error messages and steps to reproduce

---

**Happy playlist creating! 🎵** 