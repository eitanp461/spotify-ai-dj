import { Link } from 'react-router-dom'
import { Bot, Music, Sparkles, PlayCircle } from 'lucide-react'

interface HomePageProps {
  authStatus?: { authenticated: boolean; userId?: string }
}

const HomePage = ({ authStatus }: HomePageProps) => {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-0">
      {/* Hero Section */}
      <div className="text-center py-8 lg:py-16">
        <div className="flex justify-center mb-4 lg:mb-6">
          <div className="bg-spotify-green p-3 lg:p-4 rounded-full">
            <Bot size={40} className="text-white lg:hidden" />
            <Bot size={48} className="text-white hidden lg:block" />
          </div>
        </div>
        
        <h1 className="text-3xl lg:text-5xl font-bold mb-4 lg:mb-6 bg-gradient-to-r from-spotify-green to-green-400 bg-clip-text text-transparent">
          Spotify AI DJ
        </h1>
        
        <p className="text-base lg:text-xl text-gray-300 mb-6 lg:mb-8 max-w-2xl mx-auto leading-relaxed">
          Let AI create the perfect playlist for any moment. Tell us your mood, activity, or vibe, 
          and we'll curate a personalized Spotify playlist just for you.
        </p>
        
        {authStatus?.authenticated ? (
          <Link to="/chat" className="btn-primary text-base lg:text-lg inline-block min-h-[48px] flex items-center justify-center">
            Start Creating Playlist
          </Link>
        ) : (
          <div className="space-y-3 lg:space-y-4">
            <p className="text-sm lg:text-base text-gray-400">Connect your Spotify account to get started</p>
            <button 
              onClick={() => window.location.href = '/auth/spotify/login'}
              className="btn-primary text-base lg:text-lg min-h-[48px]"
            >
              Connect Spotify
            </button>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 py-8 lg:py-16 border-t border-gray-800">
        <div className="text-center sm:col-span-2 lg:col-span-1">
          <div className="bg-gray-800 p-3 lg:p-4 rounded-full w-14 h-14 lg:w-16 lg:h-16 mx-auto mb-3 lg:mb-4 flex items-center justify-center">
            <Sparkles size={28} className="text-spotify-green lg:hidden" />
            <Sparkles size={32} className="text-spotify-green hidden lg:block" />
          </div>
          <h3 className="text-lg lg:text-xl font-semibold mb-2 lg:mb-3">AI-Powered Curation</h3>
          <p className="text-sm lg:text-base text-gray-400 leading-relaxed">
            Our AI understands context, mood, and musical preferences to create the perfect playlist for any occasion.
          </p>
        </div>

        <div className="text-center">
          <div className="bg-gray-800 p-3 lg:p-4 rounded-full w-14 h-14 lg:w-16 lg:h-16 mx-auto mb-3 lg:mb-4 flex items-center justify-center">
            <Music size={28} className="text-spotify-green lg:hidden" />
            <Music size={32} className="text-spotify-green hidden lg:block" />
          </div>
          <h3 className="text-lg lg:text-xl font-semibold mb-2 lg:mb-3">Spotify Integration</h3>
          <p className="text-sm lg:text-base text-gray-400 leading-relaxed">
            Seamlessly creates playlists directly in your Spotify account with tracks from Spotify's vast catalog.
          </p>
        </div>

        <div className="text-center">
          <div className="bg-gray-800 p-3 lg:p-4 rounded-full w-14 h-14 lg:w-16 lg:h-16 mx-auto mb-3 lg:mb-4 flex items-center justify-center">
            <PlayCircle size={28} className="text-spotify-green lg:hidden" />
            <PlayCircle size={32} className="text-spotify-green hidden lg:block" />
          </div>
          <h3 className="text-lg lg:text-xl font-semibold mb-2 lg:mb-3">Instant Playback</h3>
          <p className="text-sm lg:text-base text-gray-400 leading-relaxed">
            Once created, your playlist is ready to play instantly in your Spotify app with a single click.
          </p>
        </div>
      </div>

      {/* How it Works */}
      <div className="py-8 lg:py-16 border-t border-gray-800">
        <h2 className="text-2xl lg:text-3xl font-bold text-center mb-8 lg:mb-12">How It Works</h2>
        
        <div className="space-y-6 lg:space-y-8">
          <div className="flex items-start space-x-4 lg:space-x-6">
            <div className="bg-spotify-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
              1
            </div>
            <div>
              <h3 className="text-base lg:text-lg font-semibold mb-1 lg:mb-2">Connect Your Spotify</h3>
              <p className="text-sm lg:text-base text-gray-400 leading-relaxed">Authorize the app to access your Spotify account and create playlists.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4 lg:space-x-6">
            <div className="bg-spotify-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
              2
            </div>
            <div>
              <h3 className="text-base lg:text-lg font-semibold mb-1 lg:mb-2">Chat with AI</h3>
              <p className="text-sm lg:text-base text-gray-400 leading-relaxed">Tell the AI about your mood, activity, or preferences for the perfect playlist.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4 lg:space-x-6">
            <div className="bg-spotify-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
              3
            </div>
            <div>
              <h3 className="text-base lg:text-lg font-semibold mb-1 lg:mb-2">Get Your Playlist</h3>
              <p className="text-sm lg:text-base text-gray-400 leading-relaxed">Review the AI's suggestions and create your personalized playlist in Spotify.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      {!authStatus?.authenticated && (
        <div className="text-center py-8 lg:py-16 bg-gray-800 rounded-lg mx-4 lg:mx-0">
          <h2 className="text-xl lg:text-2xl font-bold mb-3 lg:mb-4">Ready to Create Your Perfect Playlist?</h2>
          <p className="text-sm lg:text-base text-gray-400 mb-4 lg:mb-6 leading-relaxed">Connect your Spotify account and start chatting with our AI DJ.</p>
          <button 
            onClick={() => window.location.href = '/auth/spotify/login'}
            className="btn-primary min-h-[48px]"
          >
            Get Started Now
          </button>
        </div>
      )}
    </div>
  )
}

export default HomePage 