import { Routes, Route, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import axios from 'axios'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import Header from './components/Header'
import AuthCallback from './components/AuthCallback'

// Configure axios defaults
axios.defaults.withCredentials = true

interface AuthStatus {
  authenticated: boolean
  userId?: string
}

function App() {
  const [searchParams] = useSearchParams()
  const [authMessage, setAuthMessage] = useState<string>('')

  // Check authentication status
  const { data: authStatus, refetch: refetchAuth } = useQuery<AuthStatus>({
    queryKey: ['auth-status'],
    queryFn: async () => {
      const response = await axios.get('/api/auth/status')
      return response.data
    },
  })

  // Handle auth callback
  useEffect(() => {
    const authResult = searchParams.get('auth')
    const error = searchParams.get('error')
    
    if (authResult === 'success') {
      setAuthMessage('Successfully connected to Spotify!')
      refetchAuth()
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (error) {
      setAuthMessage(`Authentication failed: ${error}`)
    }
  }, [searchParams, refetchAuth])

  return (
    <div className="min-h-screen bg-gray-900">
      <Header authStatus={authStatus} refetchAuth={refetchAuth} />
      
      {authMessage && (
        <div className={`p-4 mx-4 mt-4 rounded-lg ${
          authMessage.includes('failed') ? 'bg-red-600' : 'bg-green-600'
        }`}>
          <p>{authMessage}</p>
          <button 
            className="mt-2 text-sm underline"
            onClick={() => setAuthMessage('')}
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="container mx-auto px-4 py-4 lg:py-8">
        <Routes>
          <Route path="/" element={<HomePage authStatus={authStatus} />} />
          <Route path="/chat" element={<ChatPage authStatus={authStatus} />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>
    </div>
  )
}

export default App 