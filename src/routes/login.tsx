import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase' 

export const Route = createFileRoute('/login')({
  // GUARD: If they are already logged in, don't even show this page
  beforeLoad: ({ context }) => {
    if (context.session) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginComponent,
})

function LoginComponent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'login' | 'join'; sent: boolean }>({
    type: 'login',
    sent: false,
  })

  const handleAuth = async (type: 'login' | 'join') => {
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // This tells Supabase where to send them after they click the link
        emailRedirectTo: window.location.origin, 
      },
    })

    if (!error) {
      setMessage({ type, sent: true })
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  // If the email was sent, show the "Success" state
  if (message.sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="artisan-card p-10 max-w-md w-full animate-in fade-in zoom-in duration-500">
          <h2 className="text-3xl font-serif mb-4">Verification Sent</h2>
          <p className="text-[#6B6658] mb-8 leading-relaxed text-sm">
            A secure sign-in link has been sent to <br/>
            <strong className="text-[#2D2D2D]">{email}</strong>.
          </p>
          <button 
            onClick={() => setMessage({ ...message, sent: false })}
            className="text-xs uppercase tracking-widest font-bold text-[#4A5D4E] hover:opacity-70 transition-opacity"
          >
            Change Email
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Refined Header */}
        <header className="text-center mb-10">
          <div className="inline-block px-3 py-1 bg-[#EBE7DE] rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-[#6B6658] mb-4">
            Secure Access
          </div>
          <h1 className="text-4xl font-serif text-[#2D2D2D]">Neighborhood</h1>
        </header>
  
        {/* Main Form */}
        <div className="artisan-card p-8">
          <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[#A09B8E] mb-3 ml-1">
            Email Address
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            className="artisan-input mb-6 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
  
          <div className="space-y-4">
            <button 
              onClick={() => handleAuth('login')} 
              disabled={loading || !email}
              className="btn-primary w-full"
            >
              {loading ? 'Verifying...' : 'Continue'}
            </button>
  
            <button 
              onClick={() => handleAuth('join')} 
              disabled={loading || !email}
              className="w-full py-2 text-sm text-[#6B6658] font-medium hover:text-[#2D2D2D] transition-colors"
            >
              New to the neighborhood? <span className="underline underline-offset-4">Create Account</span>
            </button>
          </div>
        </div>
        
        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-widest text-[#A09B8E] leading-loose">
            Privacy First <br/>
            <span className="opacity-50">Verified Residents Only</span>
          </p>
        </footer>
      </div>
    </div>
  )
}