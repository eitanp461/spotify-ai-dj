import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Loader2, Music, ExternalLink, Check, RotateCcw } from 'lucide-react'
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
      try {
        let displayMessage = data.message;
        let foundPlaylist = false;
        
        // Check for playlist data in the new format first
        const playlistDataMatch = data.message.match(/\[PLAYLIST_DATA\]([\s\S]*?)\[\/PLAYLIST_DATA\]/);
        if (playlistDataMatch) {
          // Hide the JSON from the displayed message
          displayMessage = data.message.replace(/\[PLAYLIST_DATA\][\s\S]*?\[\/PLAYLIST_DATA\]/g, '').trim();
          
          try {
            const playlistJson = playlistDataMatch[1].trim();
            const playlist = JSON.parse(playlistJson);
            if (Array.isArray(playlist) && playlist.length > 0 && playlist[0]?.artist && playlist[0]?.song) {
              setParsedPlaylist(playlist);
              setPlaylistName(`AI Playlist ${new Date().toLocaleDateString()}`);
              foundPlaylist = true;
              console.log('Successfully parsed playlist from PLAYLIST_DATA format:', playlist.length, 'songs');
            }
          } catch (error) {
            console.log('Could not parse playlist from PLAYLIST_DATA format:', error);
          }
        }
        
        // Fallback to old format for backwards compatibility (only if no playlist found yet)
        if (!foundPlaylist) {
          // Look for any JSON array that looks like a playlist (starts with [ and contains artist/song objects)
          const jsonMatch = data.message.match(/\[\s*\{[\s\S]*?\}\s*(?:,\s*\{[\s\S]*?\}\s*)*\]/);
          if (jsonMatch) {
            try {
              const playlist = JSON.parse(jsonMatch[0]);
              if (Array.isArray(playlist) && playlist.length > 0 && playlist[0]?.artist && playlist[0]?.song) {
                setParsedPlaylist(playlist);
                setPlaylistName(`AI Playlist ${new Date().toLocaleDateString()}`);
                foundPlaylist = true;
                console.log('Successfully parsed playlist from fallback format:', playlist.length, 'songs');
                // Remove the JSON from display
                displayMessage = data.message.replace(jsonMatch[0], '').trim();
              }
            } catch (error) {
              console.log('Could not parse JSON from fallback detection:', error);
            }
          }
          
          // If still no playlist found, try to remove any remaining JSON-like content
          if (!foundPlaylist) {
            // Remove any incomplete JSON that starts with [ but might be cut off
            displayMessage = data.message.replace(/\[\s*\{[\s\S]*$/m, '').trim();
          }
        }
        
        // Clean up any remaining artifacts
        displayMessage = displayMessage
          .replace(/\[PLAYLIST_DATA\]/g, '')
          .replace(/\[\/PLAYLIST_DATA\]/g, '')
          .replace(/\[\s*\{[\s\S]*$/m, '') // Remove any incomplete JSON at end
          .replace(/^\s*\[[\s\S]*?\]\s*$/gm, '') // Remove any standalone JSON arrays
          .replace(/^\s*\n+/gm, '\n') // Remove extra blank lines
          .trim();

        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: displayMessage,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage]);
        console.log('Chat mutation completed successfully');
      } catch (error) {
        console.error('Error processing chat response:', error);
        // Fallback: still add the raw message if processing fails
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.message || 'I received your message but had trouble processing the response.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage]);
        console.log('Chat mutation completed with fallback');
      }
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

  // Debug logging for mutation state
  useEffect(() => {
    console.log('Chat mutation isPending:', chatMutation.isPending, 'messages count:', messages.length);
  }, [chatMutation.isPending, messages.length])

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

  const handleReset = () => {
    setMessages([{
      role: 'assistant',
      content: "Hi! I'm your AI DJ assistant! 🎵\n\nI can create personalized playlists directly in your Spotify account! Tell me about:\n\n• What's your current mood? (happy, chill, energetic, etc.)\n• What activity are you planning? (work, workout, party, relaxing, etc.)\n• Any favorite genres or artists?\n• Do you want high energy or chill vibes?\n\nOnce I understand what you're looking for, I'll suggest some great songs and create a playlist for you!",
      timestamp: new Date()
    }])
    setParsedPlaylist(null)
    setCreatedPlaylist(null)
    setPlaylistName('')
    setInputMessage('')
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
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
        {/* Chat Section */}
        <div className="lg:col-span-2 order-1 lg:order-1">
          <div className="bg-gray-800 rounded-lg h-[calc(100vh-12rem)] lg:h-[600px] flex flex-col">
            {/* Chat Header */}
            <div className="p-3 lg:p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg lg:text-xl font-semibold">Chat with AI DJ</h2>
                <p className="text-xs lg:text-sm text-gray-400">Describe your perfect playlist</p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center space-x-1 text-xs lg:text-sm text-gray-400 hover:text-gray-300 transition-colors px-2 lg:px-3 py-1 rounded-lg hover:bg-gray-700 min-h-[44px] lg:min-h-auto"
                title="Reset conversation and playlist"
              >
                <RotateCcw size={16} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 lg:px-4 py-2 lg:py-2 rounded-lg whitespace-pre-wrap text-sm lg:text-base ${
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
                  <div className="bg-gray-700 px-3 lg:px-4 py-2 rounded-lg flex items-center space-x-2 text-sm lg:text-base">
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 lg:p-4 border-t border-gray-700">
              <div className="flex space-x-2 items-end">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Describe your ideal playlist... (Shift+Enter for new line, Enter to send)"
                  className="flex-1 bg-gray-700 text-white px-3 lg:px-4 py-2 lg:py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-spotify-green resize-none min-h-[3rem] lg:min-h-[4rem] max-h-24 lg:max-h-32 text-sm lg:text-base"
                  disabled={chatMutation.isPending}
                  rows={2}
                  style={{
                    height: 'auto',
                    minHeight: '3rem'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, window.innerWidth < 1024 ? 96 : 128) + 'px';
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                  className="bg-spotify-green hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 lg:px-4 py-2 lg:py-2 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Playlist Preview Section */}
        <div className="space-y-4 lg:space-y-6 order-2 lg:order-2">
          {/* Playlist Creation */}
          {parsedPlaylist ? (
            <div className="bg-gradient-to-br from-spotify-green to-green-600 rounded-lg p-4 lg:p-6 text-white shadow-lg">
              <div className="flex items-center space-x-2 mb-3 lg:mb-4">
                <Music size={20} className="lg:hidden" />
                <Music size={24} className="hidden lg:block" />
                <h3 className="text-lg lg:text-xl font-bold">🎵 Your AI Playlist is Ready!</h3>
              </div>
              
              <div className="bg-white/10 rounded-lg p-3 lg:p-4 mb-3 lg:mb-4">
                <label className="block text-sm font-medium mb-2 text-green-100">Playlist Name</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-white/20 text-white placeholder-green-100 px-3 py-2 lg:py-2 rounded focus:outline-none focus:ring-2 focus:ring-white/50 text-sm lg:text-base min-h-[44px]"
                  placeholder="Enter playlist name..."
                />
              </div>

              <div className="mb-3 lg:mb-4">
                <p className="text-sm text-green-100 mb-2 lg:mb-3 font-medium">
                  {parsedPlaylist.length} songs ready to add to your Spotify
                </p>
                <div className="bg-white/10 rounded-lg p-3 max-h-32 lg:max-h-48 overflow-y-auto">
                  <div className="space-y-1 lg:space-y-2">
                    {parsedPlaylist.map((song, index) => (
                      <div key={index} className="flex items-start space-x-2 text-xs lg:text-sm">
                        <span className="text-green-200 font-mono text-xs w-4 lg:w-6 flex-shrink-0 mt-0.5">{index + 1}.</span>
                        <span className="text-white leading-relaxed">
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
                className="w-full bg-white text-spotify-green font-bold py-3 lg:py-3 px-4 lg:px-6 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 min-h-[48px] text-sm lg:text-base"
              >
                {createPlaylistMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="lg:hidden animate-spin" />
                    <Loader2 size={20} className="hidden lg:block animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Music size={18} className="lg:hidden" />
                    <Music size={20} className="hidden lg:block" />
                    <span className="lg:hidden">Create in Spotify</span>
                    <span className="hidden lg:inline">Create Playlist in Spotify</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 lg:p-6 text-center">
              <Music size={40} className="mx-auto mb-3 text-gray-600 lg:hidden" />
              <Music size={48} className="mx-auto mb-4 text-gray-600 hidden lg:block" />
              <h3 className="text-base lg:text-lg font-semibold mb-2 text-gray-300">Playlist Preview</h3>
              <p className="text-xs lg:text-sm text-gray-400">
                Chat with the AI DJ about your musical preferences, and your personalized playlist will appear here!
              </p>
            </div>
          )}

          {/* Created Playlist */}
          {createdPlaylist && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4 lg:p-6">
              <div className="flex items-center space-x-2 mb-3 lg:mb-4">
                <Check size={18} className="text-green-400 lg:hidden" />
                <Check size={20} className="text-green-400 hidden lg:block" />
                <h3 className="text-base lg:text-lg font-semibold text-green-100">Playlist Created!</h3>
              </div>
              
              <div className="space-y-2 text-green-100">
                <p className="font-medium text-sm lg:text-base">{createdPlaylist.name}</p>
                <p className="text-xs lg:text-sm text-green-300">
                  {createdPlaylist.tracksAdded} of {createdPlaylist.totalRequested} tracks added
                </p>
                
                <a
                  href={createdPlaylist.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 lg:space-x-2 text-green-200 hover:text-green-100 transition-colors text-sm lg:text-base min-h-[44px] py-2"
                >
                  <span>Open in Spotify</span>
                  <ExternalLink size={14} className="lg:hidden" />
                  <ExternalLink size={16} className="hidden lg:block" />
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