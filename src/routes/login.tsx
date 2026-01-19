import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Mail, ShieldCheck, MapPin, DoorOpen, Map, HelpingHand, Target } from 'lucide-react'
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
    <div className="bg-hero-vision md:bg-hero-vision-md flex-grow flex flex-col font-serif">
      <main className="flex-grow">
        {/* Header Section */}
        <header className="p-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-dark mb-4">
            Community starts at your doorstep
          </h1>
          <p className="text-lg text-brand-text max-w-md mx-auto">
            The neighbors you wave to could become the friends you rely on.
          </p>
        </header>

        {/* Bento Grid */}
        <div className="bento-grid">
          
          {/* Main Auth Card */}
          <div className="card-main-focus rounded-bento-lg card-trust glass-morphism">
            <div className="flex items-start gap-2 mb-2">
              <ShieldCheck className="w-6 h-6 text-brand-dark" />
              <div className='w-full md:min-h-30 bg-flow'>
                <h3 className="font-bold text-brand-dark">Vouched Neighbors</h3>
                <p className="text-sm text-brand-text hidden md:block mt-1">Real neighbors, verified locally.</p>
              </div>
            </div>

            <div className="artisan-card-inner py-4">
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
                </div>
              )}
            </div>
          </div>

          {/* Vision Feature Cards */}
          <FeatureCard 
            Icon={MapPin} 
            title="Walking Distance" 
            desc="Only neighbors you can walk to." 
            colorClass="card-local" 
          />
          <FeatureCard 
            Icon={HelpingHand} 
            title="Help & Borrow" 
            desc="Give help. Get help." 
            colorClass="card-help" 
          />
          <FeatureCard 
            Icon={Map} 
            title="Know Your Area" 
            desc="A quiet pulse of your local area." 
            colorClass="card-social" 
          />
          <FeatureCard 
            Icon={DoorOpen} 
            title="Meet on the Porch" 
            desc="In person, by your choice." 
            colorClass="card-local" 
          />
          <FeatureCard 
            Icon={Target} 
            title="Deeds over Feeds" 
            desc="Built for action." 
            colorClass="card-deeds" 
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

function FeatureCard({ Icon, title, desc, colorClass }: { Icon: any, title: string, desc: string, colorClass: string }) {
  return (
    <div className={`card-feature rounded-bento-sm ${colorClass} glass-morphism`}>
      <Icon className="w-6 h-6 shrink-0 text-brand-dark opacity-80" strokeWidth={2} />
      <div>
        <h3 className="font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-brand-text hidden md:block mt-1">{desc}</p>
      </div>
    </div>
  )
}