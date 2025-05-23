#!/bin/bash

echo "🎵 Setting up Spotify AI DJ..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    echo "   Please update Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install && cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo ""
echo "✅ Dependencies installed successfully!"

# Create .env file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo ""
    echo "📝 Creating environment file..."
    cp backend/env.example backend/.env
    echo "✅ Created backend/.env from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit backend/.env with your credentials:"
    echo "   - Spotify Client ID and Secret (from https://developer.spotify.com/dashboard)"
    echo "   - OpenAI API Key (from https://platform.openai.com/api-keys)"
    echo "   - Session Secret (any random string)"
else
    echo ""
    echo "✅ Environment file already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your API credentials"
echo "2. Create a Spotify app at https://developer.spotify.com/dashboard"
echo "3. Add redirect URI: http://127.0.0.1:3001/auth/spotify/callback"
echo "4. Run 'npm run dev' to start the application"
echo ""
echo "Happy playlist creating! 🎵" 