import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Loader2, Music, ExternalLink, Check } from 'lucide-react'
import axios from 'axios'

interface ChatPageProps {
  authStatus?: { authenticated: boolean; userId?: string }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface PlaylistSong {
  artist: string
  song: string
}

interface CreatePlaylistResponse {
  playlist: {
    id: string
    name: string
    url: string
    tracksAdded: number
    totalRequested: number
  }
}

const ChatPage = ({ authStatus }: ChatPageProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [parsedPlaylist, setParsedPlaylist] = useState<PlaylistSong[] | null>(null)
  const [playlistName, setPlaylistName] = useState('')
  const [createdPlaylist, setCreatedPlaylist] = useState<CreatePlaylistResponse['playlist'] | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Add welcome message on first load
  useEffect(() => {
    if (authStatus?.authenticated && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm your AI DJ assistant! 🎵\n\nI can create personalized playlists directly in your Spotify account! Tell me about:\n\n• What's your current mood? (happy, chill, energetic, etc.)\n• What activity are you planning? (work, workout, party, relaxing, etc.)\n• Any favorite genres or artists?\n• Do you want high energy or chill vibes?\n\nOnce I understand what you're looking for, I'll suggest some great songs and create a playlist for you!",
        timestamp: new Date()
      }])
    }
  }, [authStatus, messages.length])

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await axios.post('/api/chat', { message })
      return response.data
    },
    onSuccess: (data) => {
      let displayMessage = data.message;
      
      // Check for playlist data in the new format
      const playlistDataMatch = data.message.match(/\[PLAYLIST_DATA\]([\s\S]*?)\[\/PLAYLIST_DATA\]/);
      if (playlistDataMatch) {
        // Hide the JSON from the displayed message
        displayMessage = data.message.replace(/\[PLAYLIST_DATA\][\s\S]*?\[\/PLAYLIST_DATA\]/, '').trim();
        
        try {
          const playlistJson = playlistDataMatch[1].trim();
          const playlist = JSON.parse(playlistJson);
          if (Array.isArray(playlist) && playlist.length > 0 && playlist[0].artist && playlist[0].song) {
            setParsedPlaylist(playlist);
            setPlaylistName(`AI Playlist ${new Date().toLocaleDateString()}`);
          }
        } catch (error) {
          console.log('Could not parse playlist from AI response');
        }
      } else {
        // Fallback to old format for backwards compatibility
        const playlistMatch = data.message.match(/\[[\s\S]*?\]/g);
        if (playlistMatch) {
          try {
            const playlist = JSON.parse(playlistMatch[0]);
            if (Array.isArray(playlist) && playlist.length > 0 && playlist[0].artist && playlist[0].song) {
              setParsedPlaylist(playlist);
              setPlaylistName(`AI Playlist ${new Date().toLocaleDateString()}`);
              // Hide JSON from display for backwards compatibility
              displayMessage = data.message.replace(playlistMatch[0], '').trim();
            }
          } catch (error) {
            console.log('Could not parse playlist from AI response');
          }
        }
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: displayMessage,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage]);
    },
    onError: (error) => {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }])
    }
  })

  const createPlaylistMutation = useMutation({
    mutationFn: async ({ name, songs }: { name: string; songs: PlaylistSong[] }) => {
      const response = await axios.post('/api/create-playlist', {
        playlistName: name,
        songs
      })
      return response.data
    },
    onSuccess: (data) => {
      setCreatedPlaylist(data.playlist)
      setParsedPlaylist(null)
    },
    onError: (error) => {
      console.error('Create playlist error:', error)
      alert('Failed to create playlist. Please try again.')
    }
  })

  const handleSendMessage = () => {
    if (!inputMessage.trim() || chatMutation.isPending) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    chatMutation.mutate(inputMessage)
    setInputMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCreatePlaylist = () => {
    if (!parsedPlaylist || !playlistName.trim()) return
    createPlaylistMutation.mutate({ name: playlistName, songs: parsedPlaylist })
  }

  if (!authStatus?.authenticated) {
    return (
      <div className="text-center py-16">
        <Music size={64} className="mx-auto mb-6 text-gray-600" />
        <h2 className="text-2xl font-bold mb-4">Connect Spotify to Start Creating</h2>
        <p className="text-gray-400 mb-6">You need to connect your Spotify account to use the AI DJ.</p>
        <button 
          onClick={() => window.location.href = '/auth/spotify/login'}
          className="btn-primary"
        >
          Connect Spotify
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Chat Section */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg h-[600px] flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold">Chat with AI DJ</h2>
              <p className="text-sm text-gray-400">Describe your perfect playlist</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-spotify-green text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your ideal playlist..."
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-spotify-green"
                  disabled={chatMutation.isPending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                  className="bg-spotify-green hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Playlist Preview Section */}
        <div className="space-y-6">
          {/* Playlist Creation */}
          {parsedPlaylist ? (
            <div className="bg-gradient-to-br from-spotify-green to-green-600 rounded-lg p-6 text-white shadow-lg">
              <div className="flex items-center space-x-2 mb-4">
                <Music size={24} />
                <h3 className="text-xl font-bold">🎵 Your AI Playlist is Ready!</h3>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium mb-2 text-green-100">Playlist Name</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-white/20 text-white placeholder-green-100 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="Enter playlist name..."
                />
              </div>

              <div className="mb-4">
                <p className="text-sm text-green-100 mb-3 font-medium">
                  {parsedPlaylist.length} songs ready to add to your Spotify
                </p>
                <div className="bg-white/10 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {parsedPlaylist.map((song, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <span className="text-green-200 font-mono text-xs w-6">{index + 1}.</span>
                        <span className="text-white">
                          <span className="font-medium">{song.artist}</span> - {song.song}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreatePlaylist}
                disabled={!playlistName.trim() || createPlaylistMutation.isPending}
                className="w-full bg-white text-spotify-green font-bold py-3 px-6 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {createPlaylistMutation.isPending ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Creating Playlist...</span>
                  </>
                ) : (
                  <>
                    <Music size={20} />
                    <span>Create Playlist in Spotify</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <Music size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold mb-2 text-gray-300">Playlist Preview</h3>
              <p className="text-sm text-gray-400">
                Chat with the AI DJ about your musical preferences, and your personalized playlist will appear here!
              </p>
            </div>
          )}

          {/* Created Playlist */}
          {createdPlaylist && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Check size={20} className="text-green-400" />
                <h3 className="text-lg font-semibold text-green-100">Playlist Created!</h3>
              </div>
              
              <div className="space-y-2 text-green-100">
                <p className="font-medium">{createdPlaylist.name}</p>
                <p className="text-sm text-green-300">
                  {createdPlaylist.tracksAdded} of {createdPlaylist.totalRequested} tracks added
                </p>
                
                <a
                  href={createdPlaylist.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-green-400 hover:text-green-300 transition-colors"
                >
                  <ExternalLink size={16} />
                  <span>Open in Spotify</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatPage 