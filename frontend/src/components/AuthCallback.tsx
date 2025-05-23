import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

const AuthCallback = () => {
  useEffect(() => {
    // This component is mainly for handling the OAuth redirect
    // The actual auth handling is done in the main App component
    // via URL parameters
  }, [])

  return (
    <div className="text-center py-16">
      <Loader2 size={48} className="mx-auto mb-4 animate-spin text-spotify-green" />
      <h2 className="text-xl font-semibold mb-2">Completing Authentication...</h2>
      <p className="text-gray-400">Please wait while we connect your Spotify account.</p>
    </div>
  )
}

export default AuthCallback 