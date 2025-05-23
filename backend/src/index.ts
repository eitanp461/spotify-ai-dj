import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables validation
const requiredEnvVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'OPENAI_API_KEY', 'SESSION_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://127.0.0.1:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Types
interface SessionData {
  spotifyTokens?: any;
  userId?: string;
  state?: string;
  conversationHistory?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

declare module 'express-session' {
  interface SessionData {
    spotifyTokens?: any;
    userId?: string;
    state?: string;
    conversationHistory?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  }
}

// Spotify OAuth endpoints
app.get('/auth/spotify/login', (req, res) => {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-top-read',
    'user-read-recently-played'
  ];
  
  const state = uuidv4();
  req.session.state = state;
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', process.env.SPOTIFY_CLIENT_ID!);
  authUrl.searchParams.append('scope', scopes.join(' '));
  authUrl.searchParams.append('redirect_uri', `${process.env.BACKEND_URL || 'http://127.0.0.1:3001'}/auth/spotify/callback`);
  authUrl.searchParams.append('state', state);
  
  res.redirect(authUrl.toString());
});

app.get('/auth/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state || state !== req.session.state) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:3000'}?error=auth_failed`);
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${process.env.BACKEND_URL || 'http://127.0.0.1:3001'}/auth/spotify/callback`
      })
    });
    
    const tokens = await tokenResponse.json() as SpotifyTokenResponse;
    
    if (tokens.error) {
      throw new Error(tokens.error_description);
    }
    
    // Store tokens in session
    req.session.spotifyTokens = tokens;
    req.session.userId = uuidv4();
    
    res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:3000'}?auth=success`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:3000'}?error=token_exchange_failed`);
  }
});

// Get current user info
app.get('/api/user', async (req, res) => {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const sdk = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, req.session.spotifyTokens);
    const user = await sdk.currentUser.profile();
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.spotifyTokens,
    userId: req.session.userId 
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Chat with AI
app.post('/api/chat', async (req, res) => {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  console.log('=== CHAT API REQUEST ===');
  console.log('User ID:', req.session.userId);
  console.log('User Message:', message);
  
  try {
    // Initialize conversation history if not exists
    if (!req.session.conversationHistory) {
      req.session.conversationHistory = [
        {
          role: 'system',
          content: `You are a Spotify AI DJ assistant connected to the user's Spotify account. You HAVE THE ABILITY to create playlists directly in their Spotify account.

CRITICAL RULES - NEVER VIOLATE THESE:
1. ONLY suggest songs that actually exist and are popular/well-known
2. NEVER mix up artists with their songs - verify each song belongs to the correct artist
3. If you're not 100% sure a song exists by that artist, DON'T include it
4. Use only mainstream, popular songs that are likely to be on Spotify
5. When in doubt, ask for clarification rather than guessing

Your capabilities:
- Ask questions about musical preferences, mood, activity, and genre preferences
- Suggest ONLY real, verifiable songs and artists
- Create actual playlists in their Spotify account when ready

Workflow:
1. Ask clarifying questions about their mood, activity, genre preferences, energy level, etc.
2. Suggest specific songs and artists that match their requirements - but ONLY songs you are certain exist
3. When they're satisfied and ready to create the playlist, say something like "Perfect! Let me create this playlist for you now!" and provide the songs in BOTH formats:

First, show a nice human-readable list like:
🎵 Here's your perfect playlist:
• Artist Name - Song Title
• Artist Name - Song Title
• Artist Name - Song Title

Then, immediately after (on the same response), provide the JSON array for system processing:
[PLAYLIST_DATA]
[
  {"artist": "Artist Name", "song": "Song Title"},
  {"artist": "Artist Name", "song": "Song Title"}
]
[/PLAYLIST_DATA]

IMPORTANT GUIDELINES:
- Always provide 15-25 songs when creating a playlist
- Use ONLY real, popular song titles and artist names that you are confident exist
- Double-check that each song actually belongs to the artist you're assigning it to
- If asked for a specific artist, only include songs you KNOW are by that artist
- The JSON will be hidden from the user - they'll only see your nice formatted list
- Be enthusiastic about creating playlists!
- Only provide the JSON when they're ready to actually create the playlist
- If unsure about a song, skip it rather than risk including incorrect information

EXAMPLE OF WHAT NOT TO DO:
- Don't suggest "Taylor Swift - Bohemian Rhapsody" (that's by Queen)
- Don't make up song titles that sound like they could exist
- Don't mix artist names with wrong songs

Be conversational, helpful, and enthusiastic about music while being absolutely accurate!`
        }
      ];
      console.log('Initialized new conversation history');
    }
    
    // Add user message to conversation
    req.session.conversationHistory.push({
      role: 'user',
      content: message
    });
    
    console.log('Conversation History Length:', req.session.conversationHistory.length);
    console.log('Current Conversation:', JSON.stringify(req.session.conversationHistory, null, 2));
    
    console.log('=== OPENAI API REQUEST ===');
    const openaiRequest = {
      model: 'gpt-3.5-turbo',
      messages: req.session.conversationHistory,
      max_tokens: 1000,
      temperature: 0.7,
    };
    console.log('OpenAI Request:', JSON.stringify(openaiRequest, null, 2));
    
    // Get AI response
    const startTime = Date.now();
    const completion = await openai.chat.completions.create(openaiRequest);
    const endTime = Date.now();
    
    console.log('=== OPENAI API RESPONSE ===');
    console.log('Response Time:', `${endTime - startTime}ms`);
    console.log('Response Object:', JSON.stringify(completion, null, 2));
    
    const aiResponse = completion.choices[0].message.content;
    console.log('AI Response Content:', aiResponse);
    console.log('AI Response Length:', aiResponse?.length || 0, 'characters');
    
    // Check if response contains playlist data
    const hasPlaylistData = aiResponse?.includes('[PLAYLIST_DATA]') || /\[[\s\S]*?\]/.test(aiResponse || '');
    console.log('Contains Playlist Data:', hasPlaylistData);
    
    // Add AI response to conversation
    req.session.conversationHistory.push({
      role: 'assistant',
      content: aiResponse || ''
    });
    
    console.log('Updated Conversation History Length:', req.session.conversationHistory.length);
    
    const response = { 
      message: aiResponse,
      conversationId: req.session.userId 
    };
    
    console.log('=== API RESPONSE TO FRONTEND ===');
    console.log('Response:', JSON.stringify(response, null, 2));
    
    res.json(response);
    
  } catch (error: any) {
    console.error('=== CHAT ERROR ===');
    console.error('Error Type:', error.constructor?.name || 'Unknown');
    console.error('Error Message:', error.message || 'No message');
    console.error('Full Error:', error);
    
    if (error.response) {
      console.error('OpenAI API Error Response:', error.response.status, error.response.data);
    }
    
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Create playlist from AI suggestions
app.post('/api/create-playlist', async (req, res) => {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { playlistName, songs } = req.body;
  
  if (!playlistName || !songs || !Array.isArray(songs)) {
    return res.status(400).json({ error: 'Playlist name and songs array are required' });
  }
  
  try {
    const sdk = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, req.session.spotifyTokens);
    const user = await sdk.currentUser.profile();
    
    // Create playlist
    const playlist = await sdk.playlists.createPlaylist(user.id, {
      name: playlistName,
      description: 'Created by Spotify AI DJ',
      public: false
    });
    
    // Search for songs and add to playlist
    const trackUris: string[] = [];
    
    for (const song of songs) {
      try {
        const searchQuery = `track:"${song.song}" artist:"${song.artist}"`;
        const searchResults = await sdk.search(searchQuery, ['track'], 'US', 1);
        
        if (searchResults.tracks.items.length > 0) {
          trackUris.push(searchResults.tracks.items[0].uri);
        } else {
          // Fallback: search with just song and artist name
          const fallbackQuery = `${song.song} ${song.artist}`;
          const fallbackResults = await sdk.search(fallbackQuery, ['track'], 'US', 1);
          if (fallbackResults.tracks.items.length > 0) {
            trackUris.push(fallbackResults.tracks.items[0].uri);
          }
        }
      } catch (error) {
        console.error(`Error searching for song: ${song.artist} - ${song.song}`, error);
      }
    }
    
    // Add tracks to playlist
    if (trackUris.length > 0) {
      await sdk.playlists.addItemsToPlaylist(playlist.id, trackUris);
    }
    
    res.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls.spotify,
        tracksAdded: trackUris.length,
        totalRequested: songs.length
      }
    });
    
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🎵 Spotify AI DJ Backend running on port ${PORT}`);
}); 