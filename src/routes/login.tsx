import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Mail, ShieldCheck, MapPin, HelpingHand } from 'lucide-react'
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
  const [emailValid, setEmailValid] = useState<boolean | null>(null)
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

  const validateEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmailValid(/\S+@\S+\.\S+/.test(value));
    setEmail(value)
  }

  return (
    <div className="bg-brand-bg min-h-screen flex flex-col selection:bg-brand-green/30">
      <main className="flex-grow flex flex-col items-center">
        
        {/* Header Section */}
        <div className="animate-reveal w-full">
          <div className="flex items-center justify-center mt-10">
            <img src="/logo.png" alt="LocalLoop" className="h-10 w-auto" />
            <span className="text-2xl font-bold text-brand-terracotta ml-2">LocalLoop</span>
          </div>
          
          <header className="px-6 pt-10 pb-6 text-center">
            <h1 className="text-2xl md:text-4xl font-black text-brand-dark mb-5 tracking-tighter leading-[1.1]">
              Your street. Your neighbors.<br/>
              <span className="text-brand-terracotta">Real help when you need it.</span>
            </h1>

            <p className="text-sm md:text-base text-brand-text max-w-[480px] mx-auto font-medium leading-relaxed opacity-90">
              Connect with verified neighbors within walking distance for services, borrowing, and mutual support. 
              <span className="hidden md:inline"><br/></span>
              No posts. No noise. Just neighbors helping neighbors.
            </p>
          </header>
        </div>

        <div className="artisan-container-large px-6">
          <div className="artisan-card border-0">
            {message.sent ? (
              <div className="text-center animate-reveal">
                <span className="text-2xl font-black text-brand-dark block tracking-tight">Verification Sent</span>
                <span className="mt-4 text-brand-text block text-sm font-medium leading-relaxed">
                  A link has been sent to <br/>
                  <strong className="text-brand-dark underline decoration-brand-green/30">{email}</strong>
                </span>
                <button 
                  onClick={() => setMessage({ ...message, sent: false })}
                  className="mt-10 text-label underline underline-offset-8 block w-full hover:text-brand-terracotta transition-colors"
                >
                  Change Email
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                <label className="text-label mb-3 ml-1">Email Address</label>
                <div className="input-group">
                  <Mail className={`input-icon ${emailValid ? 'text-brand-green' : 'text-brand-muted'}`} />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className={`artisan-input pl-14 ${
                      emailValid === true ? 'artisan-input-success' : 
                      emailValid === false && email.length > 0 ? 'artisan-input-error' : ''
                    }`}
                    value={email}
                    onChange={validateEmail}
                    disabled={loading}
                  />
                </div>

                <button 
                  onClick={() => handleAuth('login')} 
                  disabled={loading || !emailValid}
                  className="btn-secondary mt-6"
                >
                  {loading ? 'Verifying...' : 'Login or Join your neighborhood'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="bento-grid mt-12">
          <FeatureCard Icon={ShieldCheck} index={0} title="Verified Neighbors only" desc="Invitation + GPS verification keeps your circle trusted." colorClass="card-trust" />
          <FeatureCard Icon={MapPin} index={1} title="Walking Distance only" desc="Only neighbors within 0.5 miles. No strangers across town" colorClass="card-local" />
          <FeatureCard Icon={HelpingHand} index={2} title="Requests, not posts" desc="Ask for help when you need it. No feeds. No drama." colorClass="card-help" />
        </div>
      </main>
    </div>
  )
}