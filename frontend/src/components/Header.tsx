import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Music, User, LogOut } from 'lucide-react'
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
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleLogin = () => {
    window.location.href = '/auth/spotify/login'
  }

  return (
    <header className="bg-spotify-black border-b border-gray-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 text-spotify-green">
            <Music size={32} />
            <span className="text-xl font-bold">Spotify AI DJ</span>
          </Link>

          {/* Navigation */}
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

          {/* User section */}
          <div className="flex items-center space-x-4">
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
                  <span className="text-sm hidden sm:block">{user.display_name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:block">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="btn-primary"
              >
                Connect Spotify
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header 