import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase' 

export const Route = createFileRoute('/login')({
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
      options: { emailRedirectTo: window.location.origin },
    })

    if (!error) {
      setMessage({ type, sent: true })
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="artisan-page-focus p-6">
      <div className="w-full max-w-md">
        <header className="artisan-header">
          <div className="badge-pill mb-4">
            Secure Access
          </div>
          <h1 className="artisan-header-title">Neighborhood</h1>
        </header>

        <div className="artisan-card">
          <div className="artisan-card-inner">
            {message.sent ? (
              <div className="text-center animate-in">
                <div className="mb-8">
                  <span className="alert-title font-serif text-2xl">Verification Sent</span>
                  <span className="alert-body mt-2">
                    A secure link has been sent to <br/>
                    <strong className="text-brand-dark">{email}</strong>
                  </span>
                </div>
                <button 
                  onClick={() => setMessage({ ...message, sent: false })}
                  className="link-standard underline underline-offset-4 w-full"
                >
                  Change Email
                </button>
              </div>
            ) : (
              <>
                <label className="text-label mb-3 ml-1 block">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="artisan-input mb-6"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />

                <div className="space-y-4">
                  <button 
                    onClick={() => handleAuth('login')} 
                    disabled={loading || !email}
                    className="btn-primary"
                  >
                    {loading ? 'Verifying...' : 'Sign in'}
                  </button>

                  <button 
                    onClick={() => handleAuth('join')} 
                    disabled={loading || !email}
                    className="link-standard w-full text-left py-2"
                  >
                    New? Enter your email to <span className="underline underline-offset-4">Create Account</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        
        <footer className="mt-12 text-center mb-8">
          <p className="text-brand-muted mt-4">
            Verified Residents Only
          </p>
        </footer>
      </div>
    </div>
  )
}