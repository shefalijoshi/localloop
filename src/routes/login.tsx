import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Mail, ShieldCheck, MapPin, DoorOpen, Map, HelpingHand, Target } from 'lucide-react'
import { supabase } from '../lib/supabase' 
import { FeatureCard } from '../components/Feature'

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
    <div className="bg-hero-vision md:bg-hero-vision-md flex-grow flex flex-col font-serif">
      <main className="flex-grow">
        {/* Header Section */}
        <div className="flex items-center justify-center mt-5">
          <img 
            src="/logo.png" 
            alt="LocalLoop" 
            className="h-10 w-auto"
          />
          <span className="text-2xl font-bold text-brand-terracotta">LocalLoop</span>
        </div>
        <header className="p-8 text-center">
          <h1 className="text-xl md:3xl font-bold text-brand-dark mb-4">
            Your street. Your neighbors. Real help when you need it.
          </h1>
          <p className="text-sm text-brand-text max-w-md mx-auto">
          Connect with verified neighbors within walking distance for services, borrowing, and mutual support. No posts. No noise. Just neighbors helping neighbors.
          </p>
        </header>

        <div className="card-cta artisan-card-inner py-4">
          {message.sent ? (
            <div className="text-center animate-in">
              <div className="mb-8">
                <span className="alert-title text-2xl font-bold text-brand-dark block">Verification Sent</span>
                <span className="alert-body mt-2 text-brand-text block">
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
            <div className="flex flex-col">
              <label className="text-label mb-3 ml-1 block">
                Email Address
              </label>
              <div className="relative mb-6">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  type="email"
                  autoComplete='email'
                  placeholder="Enter your email"
                  className="artisan-input pl-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => handleAuth('login')} 
                  disabled={loading || !email}
                  className="btn-primary bg-brand-terracotta text-white"
                >
                  {loading ? 'Verifying...' : 'Login or Join your neighborhood'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bento Grid */}
        <div className="bento-grid mt-5 md:mt-15">
          <FeatureCard
            Icon={ShieldCheck} 
            index={0}
            title="Verified Neighbors only" 
            desc="Invitation + GPS verification keeps your circle trusted." 
            colorClass="card-trust card-main-focus"
            bgClass="text-trust-blue-icon"
          />

          <FeatureCard
            Icon={MapPin} 
            index={1}
            title="Walking Distance only" 
            desc="Only neighbors within 0.5 miles. No strangers across town" 
            colorClass="card-local" 
            bgClass="text-local-yellow-icon"
          />
          <FeatureCard 
            Icon={HelpingHand} 
            index={2}
            title="Requests, not posts" 
            desc="Ask for help when you need it. No feeds. No drama."
            colorClass="card-help" 
            bgClass="text-help-pink-icon"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-6 border-t border-brand-border bg-white/30 glass-morphism text-center">
        <p className="text-brand-muted text-sm">
          © {new Date().getFullYear()} LocalLoop. Verified Residents Only.
        </p>
      </footer>
    </div>
  )
}