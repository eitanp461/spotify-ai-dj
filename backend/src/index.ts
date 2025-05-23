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
    'user-read-recently-played',
    'user-modify-playback-state',
    'user-read-playback-state'
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

// Helper function to search for candidate songs
async function searchCandidateSongs(tokens: any, searchTerms: string[]) {
  const sdk = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, tokens);
  const candidateSongs: Array<{artist: string, song: string}> = [];
  
  for (const term of searchTerms) {
    try {
      const searchResults = await sdk.search(term, ['track'], 'US', 10);
      for (const track of searchResults.tracks.items) {
        candidateSongs.push({
          artist: track.artists[0].name,
          song: track.name
        });
      }
    } catch (error) {
      console.error(`Error searching for: ${term}`, error);
    }
  }
  
  // Remove duplicates
  const uniqueSongs = candidateSongs.filter((song, index, self) => 
    index === self.findIndex(s => s.artist === song.artist && s.song === song.song)
  );
  
  return uniqueSongs.slice(0, 50); // Limit to top 50 candidates
}

// Helper function to detect if user wants playlist creation using GPT
async function shouldGeneratePlaylist(message: string): Promise<boolean> {
  try {
    console.log('🔍 Analyzing user intent with GPT...');
    
    const intentAnalysis = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier. Analyze if the user is asking to CREATE/GENERATE a playlist or select songs.

RETURN ONLY: "YES" or "NO"

YES if user wants to:
- Create a playlist
- Generate songs
- Make a playlist  
- Build a playlist
- Select songs for them
- Ready to create playlist
- Asking for specific songs to be chosen

NO if user is:
- Just chatting about music
- Asking questions about artists
- Describing preferences without wanting creation
- General conversation

Examples:
"Create a workout playlist" → YES
"תכין לי פלייליסט לריצה" → YES  
"Haz una lista de canciones románticas" → YES
"I'm ready, make the playlist" → YES
"What's your favorite genre?" → NO
"Tell me about Taylor Swift" → NO
"I like rock music" → NO

Respond with ONLY "YES" or "NO".`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const response = intentAnalysis.choices[0].message.content?.trim().toUpperCase();
    const isPlaylistRequest = response === 'YES';
    
    console.log(`🔍 Intent Analysis: "${message}" → ${response} (${isPlaylistRequest ? 'PLAYLIST' : 'CHAT'})`);
    return isPlaylistRequest;
    
  } catch (error) {
    console.error('Intent analysis failed, falling back to keyword detection:', error);
    
    // Fallback to simple keyword detection
    const playlistTriggers = [
      'create', 'make', 'generate', 'build', 'playlist', 'songs',
      'ready', 'let\'s do it', 'sounds good', 'perfect', 'yes'
    ];
    
    return playlistTriggers.some(trigger => 
      message.toLowerCase().includes(trigger.toLowerCase())
    );
  }
}

// Helper function to determine which model to use
function selectOptimalModel(
  isPlaylistGeneration: boolean, 
  hasCandidateSongs: boolean,
  conversationHistory: any[]
): 'gpt-3.5-turbo' | 'gpt-4-turbo' {
  
  // Use GPT-4-turbo for critical tasks requiring factual accuracy
  if (isPlaylistGeneration || hasCandidateSongs) {
    console.log('🧠 Using GPT-4-turbo for playlist generation (high accuracy needed)');
    return 'gpt-4-turbo';
  }
  
  // Check if this looks like a factual question about music
  const lastMessage = conversationHistory[conversationHistory.length - 1]?.content || '';
  const factualTriggers = [
    'who is', 'what is', 'tell me about', 'do you know', 'have you heard',
    'is there a song', 'does exist', 'real song', 'actual song'
  ];
  
  const needsFactualAccuracy = factualTriggers.some(trigger => 
    lastMessage.toLowerCase().includes(trigger)
  );
  
  if (needsFactualAccuracy) {
    console.log('🧠 Using GPT-4-turbo for factual accuracy');
    return 'gpt-4-turbo';
  }
  
  // Use GPT-3.5-turbo for general conversation, clarifying questions
  console.log('💬 Using GPT-3.5-turbo for general conversation (cost optimization)');
  return 'gpt-3.5-turbo';
}

// Helper function to extract search terms from user message
function extractSearchTerms(message: string): string[] {
  const terms = [];
  
  // Extract specific artist names mentioned in the message
  const artistPatterns = [
    /(?:by|from|artist)\s+([a-zA-Z\u0590-\u05FF\s]{2,30})/gi,
    /([a-zA-Z\u0590-\u05FF\s]{2,30})(?:\s*-|\s+songs?|\s+music)/gi
  ];
  
  for (const pattern of artistPatterns) {
    const matches = [...message.matchAll(pattern)];
    for (const match of matches) {
      if (match[1] && match[1].trim().length > 2) {
        terms.push(match[1].trim());
      }
    }
  }
  
  // Language/region specific searches
  if (message.toLowerCase().includes('hebrew') || /[\u0590-\u05FF]/.test(message)) {
    terms.push('israeli music', 'hebrew songs', 'israel charts');
  }
  if (message.toLowerCase().includes('spanish') || message.toLowerCase().includes('español')) {
    terms.push('latin music', 'spanish songs', 'latin charts');
  }
  if (message.toLowerCase().includes('korean') || message.toLowerCase().includes('k-pop')) {
    terms.push('k-pop', 'korean music', 'korean charts');
  }
  
  // Common mood/genre terms for searching
  const moodGenreMap: {[key: string]: string[]} = {
    'happy': ['pop', 'upbeat', 'feel good', 'happy'],
    'birthday': ['birthday', 'celebration', 'party', 'upbeat'],
    'sad': ['sad', 'emotional', 'ballad', 'melancholy'],
    'energetic': ['electronic', 'dance', 'high energy', 'workout'],
    'chill': ['chill', 'ambient', 'lo-fi', 'relaxing'],
    'workout': ['pump up', 'gym', 'motivation', 'high energy'],
    'party': ['party', 'dance', 'club', 'upbeat'],
    'romantic': ['romantic', 'love', 'ballad', 'slow'],
    'rock': ['rock', 'alternative', 'indie rock'],
    'pop': ['pop', 'mainstream', 'chart'],
    'hip hop': ['hip hop', 'rap', 'urban'],
    'electronic': ['electronic', 'edm', 'techno', 'house'],
    'jazz': ['jazz', 'smooth jazz', 'bebop'],
    'classical': ['classical', 'orchestral', 'symphony']
  };
  
  // Extract genre/mood terms from message
  for (const [key, searchTerms] of Object.entries(moodGenreMap)) {
    if (message.toLowerCase().includes(key)) {
      terms.push(...searchTerms);
    }
  }
  
  // Add some default popular terms if none found
  if (terms.length === 0) {
    terms.push('popular', 'top hits', 'chart toppers');
  }
  
  console.log('🔍 Extracted search terms:', terms);
  return [...new Set(terms)]; // Remove duplicates
}

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
          content: `You are a Spotify AI DJ assistant connected to the user's Spotify account. You HAVE THE ABILITY to create playlists directly in their Spotify account. You can suggest songs in ANY LANGUAGE, but you must be absolutely certain they exist.

🤖 MODEL STRATEGY: This conversation uses intelligent model selection:
- GPT-3.5-turbo for general chat and clarifying questions (cost-efficient)
- GPT-4-turbo for playlist generation and factual accuracy (high-quality)
You'll automatically get the best model for each task!

🚨 CRITICAL ANTI-HALLUCINATION RULES - ABSOLUTELY NEVER VIOLATE THESE:

1. ZERO TOLERANCE FOR MADE-UP SONGS: If you're not 100% certain a song exists with that exact title by that exact artist, DO NOT include it
2. HIGHER STANDARDS FOR NON-ENGLISH SONGS: For songs in languages other than English, only suggest them if they are extremely well-known, internationally successful, or from major artists you're certain about
3. VERIFY ARTIST-SONG PAIRINGS: Never mix up which artist performed which song - this is a critical error
4. WHEN IN DOUBT, SKIP IT: If you have ANY uncertainty about a song's existence or artist, do not include it
5. PREFER WELL-DOCUMENTED HITS: Stick to songs that have achieved significant chart success, streaming numbers, or cultural impact

APPROVED SONG EXAMPLES (use songs of this caliber in ANY language):

✅ ENGLISH: "The Weeknd - Blinding Lights", "Dua Lipa - Don't Start Now", "Ed Sheeran - Shape of You"
✅ SPANISH: "Bad Bunny - Yonaguni", "Rosalía - Malamente", "Jesse & Joy - ¡Corre!"
✅ KOREAN: "BTS - Dynamite", "BLACKPINK - DDU-DU DDU-DU", "PSY - Gangnam Style"
✅ FRENCH: "Stromae - Alors on danse", "Indila - Dernière danse", "Zaz - Je veux"
✅ GERMAN: "Rammstein - Du hast", "Nena - 99 Luftballons", "CRO - Easy"
✅ PORTUGUESE: "Anitta - Envolver", "João Gilberto - The Girl from Ipanema"
✅ ITALIAN: "Måneskin - Beggin'", "Laura Pausini - La solitudine"
✅ JAPANESE: "One Ok Rock - Wherever You Are", "Utada Hikaru - First Love"
✅ HEBREW: "Omer Adam - Tel Aviv", "Subliminal - Exile" (only if internationally known)

CRITICAL FEW-SHOT EXAMPLES OF WHAT NOT TO DO:
❌ BAD: "Idan Raichel - Sunset in Tel Aviv" (does not exist - made up title)
✅ GOOD: "Idan Raichel - Mima'amakim" (real song)
❌ BAD: "Eyal Golan - Dancing Tonight" (translation assumption)
✅ GOOD: "Eyal Golan - Lecha Dodi" (if certain it exists)
❌ BAD: "Taylor Swift - Bohemian Rhapsody" (wrong artist pairing)
✅ GOOD: "Queen - Bohemian Rhapsody" (correct pairing)

❌ NEVER DO THESE:
❌ Making up song titles that "sound right" in any language
❌ Suggesting local/regional songs you're unsure about
❌ Mixing artists with wrong songs
❌ Including any song you can't verify 100%
❌ Translating English song titles into other languages and assuming they exist

🧠 MANDATORY SELF-CHECK PROCESS:
Before suggesting ANY song, ask yourself:
1. "Is this a real song I know exists with this exact artist pairing?"
2. "Have I heard this song or seen it on charts/streaming platforms?"
3. "Am I 100% certain this isn't a made-up title that just sounds plausible?"
If ANY answer is uncertain, SKIP that song immediately.

Your capabilities:
- Ask questions about musical preferences, mood, activity, genre preferences, and language preferences
- Suggest songs in any language, but only those you are absolutely certain exist
- Create actual playlists in their Spotify account when ready

Workflow:
1. Ask clarifying questions about their mood, activity, genre preferences, energy level, preferred languages, etc.
2. When user requests playlist creation, you will receive a list of VERIFIED CANDIDATE SONGS from Spotify's database
3. SELECT ONLY from the provided candidate songs - never add songs not on the list
4. When ready to create the playlist, provide the selected songs in BOTH formats:

First, show a nice human-readable list like:
🎵 Here's your perfect playlist:
• Artist Name - Song Title
• Artist Name - Song Title
• Artist Name - Song Title

Then, IMMEDIATELY after (on the same response), provide the JSON array for system processing wrapped in the exact format:
[PLAYLIST_DATA]
[
  {"artist": "Artist Name", "song": "Song Title"},
  {"artist": "Artist Name", "song": "Song Title"}
]
[/PLAYLIST_DATA]

CRITICAL: You MUST use the [PLAYLIST_DATA] wrapper tags. Do NOT just put a raw JSON array without the wrapper tags.

FINAL GUIDELINES:
- Always provide 15-25 songs when creating a playlist
- When candidate songs are provided, ONLY choose from that verified list - never add others
- If no candidate songs are provided, use your knowledge but apply maximum caution
- Ask about language preferences if not specified
- The JSON will be hidden from the user - they'll only see your nice formatted list
- Be enthusiastic about creating multilingual playlists while being absolutely accurate!
- Only provide the JSON when they're ready to actually create the playlist

🎯 RAG APPROACH: When you receive a list of "CANDIDATE SONGS AVAILABLE", you MUST only select from that verified list. NEVER add songs not on the list. This eliminates hallucination risk completely!

⚠️ MANDATORY: If you receive candidate songs, you can ONLY choose from those songs. Do not add any additional songs from your knowledge, even if they seem to fit perfectly.

Remember: It's better to have fewer songs that definitely exist than to include even one made-up song, regardless of language!`
        }
      ];
      console.log('Initialized new conversation history');
    }
    
    // Check if user wants to create a playlist
    const wantsPlaylist = await shouldGeneratePlaylist(message);
    let candidateSongs: Array<{artist: string, song: string}> = [];
    
    // If user wants playlist, get candidate songs from Spotify first
    if (wantsPlaylist) {
      console.log('=== PLAYLIST GENERATION DETECTED ===');
      const searchTerms = extractSearchTerms(message);
      console.log('Search Terms:', searchTerms);
      
      candidateSongs = await searchCandidateSongs(req.session.spotifyTokens, searchTerms);
      console.log('Found Candidate Songs:', candidateSongs.length);
    }
    
    // Add user message to conversation
    req.session.conversationHistory.push({
      role: 'user',
      content: message
    });
    
    // If we have candidate songs, modify the user message to include them
    let enhancedMessage = message;
    if (candidateSongs.length > 0) {
      enhancedMessage = `${message}

CANDIDATE SONGS AVAILABLE (choose from these verified songs):
${candidateSongs.map(song => `• ${song.artist} - ${song.song}`).join('\n')}

Please select approximately 15-25 songs from this list that best match the user's request. Only choose from this verified list.`;
    }
    
    console.log('Conversation History Length:', req.session.conversationHistory.length);
    console.log('Enhanced Message:', enhancedMessage);
    
    // Select optimal model based on task complexity and accuracy needs
    const selectedModel = selectOptimalModel(wantsPlaylist, candidateSongs.length > 0, req.session.conversationHistory);
    
    // Adjust parameters based on model choice
    const modelConfig = {
      'gpt-3.5-turbo': {
        maxTokens: 1000,
        temperature: 0.3
      },
      'gpt-4-turbo': { // GPT-4 Turbo for better accuracy
        maxTokens: 1000,
        temperature: 0.2  // Lower temperature for higher accuracy
      }
    };
    
    const config = modelConfig[selectedModel];
    
    console.log('=== OPENAI API REQUEST ===');
    console.log(`🤖 Selected Model: ${selectedModel}`);
    console.log(`⚙️ Config:`, config);
    
    const messages = candidateSongs.length > 0 
      ? [
          ...req.session.conversationHistory.slice(0, -1), // All messages except the last user message
          {
            role: 'user' as const,
            content: enhancedMessage // Use enhanced message with candidate songs
          }
        ]
      : req.session.conversationHistory;
      
    const openaiRequest = {
      model: selectedModel,
      messages: messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    };
    console.log('OpenAI Request Keys:', Object.keys(openaiRequest));
    
    // Get AI response
    const startTime = Date.now();
    const completion = await openai.chat.completions.create(openaiRequest);
    const endTime = Date.now();
    
    console.log('=== OPENAI API RESPONSE ===');
    console.log('Response Time:', `${endTime - startTime}ms`);
    console.log(`🤖 Model Used: ${selectedModel}`);
    console.log('Usage:', completion.usage);
    
    // Calculate estimated cost (approximate)
    const costPer1kTokens = selectedModel === 'gpt-4-turbo' ? 0.01 : 0.002; // GPT-4: $0.01, GPT-3.5: $0.002 per 1k tokens
    const totalTokens = completion.usage?.total_tokens || 0;
    const estimatedCost = (totalTokens / 1000) * costPer1kTokens;
    console.log(`💰 Estimated Cost: $${estimatedCost.toFixed(4)} (${totalTokens} tokens)`);
    
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

// Play track on user's active device
app.post('/api/play-track', async (req, res) => {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { artist, song } = req.body;
  
  if (!artist || !song) {
    return res.status(400).json({ error: 'Artist and song are required' });
  }
  
  try {
    const sdk = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, req.session.spotifyTokens);
    
    // Search for the track
    const searchQuery = `track:"${song}" artist:"${artist}"`;
    const searchResults = await sdk.search(searchQuery, ['track'], 'US', 1);
    
    let trackUri = null;
    
    if (searchResults.tracks.items.length > 0) {
      trackUri = searchResults.tracks.items[0].uri;
    } else {
      // Fallback: search with just song and artist name
      const fallbackQuery = `${song} ${artist}`;
      const fallbackResults = await sdk.search(fallbackQuery, ['track'], 'US', 1);
      if (fallbackResults.tracks.items.length > 0) {
        trackUri = fallbackResults.tracks.items[0].uri;
      }
    }
    
    if (!trackUri) {
      return res.status(404).json({ error: 'Track not found on Spotify' });
    }
    
    // Get user's available devices
    const devices = await sdk.player.getAvailableDevices();
    
    if (devices.devices.length === 0) {
      return res.status(400).json({ 
        error: 'No active Spotify devices found. Please open Spotify on one of your devices and try again.' 
      });
    }
    
    // Find an active device or use the first available one
    let targetDevice = devices.devices.find(device => device.is_active);
    if (!targetDevice) {
      targetDevice = devices.devices[0];
    }
    
    // Start playback
    await sdk.player.startResumePlayback(targetDevice.id!, undefined, [trackUri]);
    
    res.json({
      success: true,
      message: `Now playing: ${artist} - ${song}`,
      track: trackUri,
      device: targetDevice.name
    });
    
  } catch (error: any) {
    console.error('Play track error:', error);
    
    // Handle specific Spotify API errors
    if (error.status === 404) {
      return res.status(404).json({ 
        error: 'No active device found. Please open Spotify and start playing something, then try again.' 
      });
    } else if (error.status === 403) {
      return res.status(403).json({ 
        error: 'Premium subscription required to control playback.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to play track. Make sure Spotify is open and active on one of your devices.' 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🎵 Spotify AI DJ Backend running on port ${PORT}`);
}); 