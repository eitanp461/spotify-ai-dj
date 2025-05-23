import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Music, User, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'

interface HeaderProps {
  authStatus?: { authenticated: boolean; userId?: string }
  refetchAuth: () => void
}

interface UserProfile {
  display_name: string
  images: Array<{ url: string }>
  email: string
}

const Header = ({ authStatus, refetchAuth }: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const queryClient = useQueryClient()

  // Get user profile if authenticated
  const { data: user } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await axios.get('/api/user')
      return response.data
    },
    enabled: authStatus?.authenticated,
  })

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout')
      queryClient.clear()
      refetchAuth()
      setIsMobileMenuOpen(false)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleLogin = () => {
    window.location.href = '/auth/spotify/login'
  }

  return (
    <header className="bg-spotify-black border-b border-gray-800">
      <div className="container mx-auto px-4 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 text-spotify-green">
            <Music size={28} className="lg:hidden" />
            <Music size={32} className="hidden lg:block" />
            <span className="text-lg lg:text-xl font-bold">Spotify AI DJ</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              to="/" 
              className="hover:text-spotify-green transition-colors"
            >
              Home
            </Link>
            {authStatus?.authenticated && (
              <Link 
                to="/chat" 
                className="hover:text-spotify-green transition-colors"
              >
                Create Playlist
              </Link>
            )}
          </nav>

          {/* Desktop User section */}
          <div className="hidden md:flex items-center space-x-4">
            {authStatus?.authenticated && user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {user.images?.[0] ? (
                    <img 
                      src={user.images[0].url} 
                      alt={user.display_name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User size={20} className="text-gray-400" />
                  )}
                  <span className="text-sm hidden lg:block">{user.display_name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                  <span className="hidden lg:block">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="btn-primary min-h-[44px]"
              >
                Connect Spotify
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-gray-700">
            <nav className="space-y-4">
              <Link 
                to="/" 
                className="block text-lg hover:text-spotify-green transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              {authStatus?.authenticated && (
                <Link 
                  to="/chat" 
                  className="block text-lg hover:text-spotify-green transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Playlist
                </Link>
              )}
              
              {/* Mobile User section */}
              <div className="pt-4 border-t border-gray-700">
                {authStatus?.authenticated && user ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      {user.images?.[0] ? (
                        <img 
                          src={user.images[0].url} 
                          alt={user.display_name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <User size={24} className="text-gray-400" />
                      )}
                      <span className="text-lg">{user.display_name}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-lg"
                    >
                      <LogOut size={20} />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="btn-primary w-full min-h-[48px] text-lg"
                  >
                    Connect Spotify
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header 