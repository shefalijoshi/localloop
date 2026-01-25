import { Passcode } from '../components/Passcode'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/_auth/vouch-pending')({
  beforeLoad: ({ context }) => {
    if (context.membershipStatus === 'active' || context.membershipStatus === 'request_pending') {
      throw redirect({ to: '/' })
    }
  },
  component: VouchPendingPage,
})

function SecurityBadge({ isExpired }: { isExpired: boolean }) {
  return (
    <div className="badge-pill mb-4 animate-in fade-in duration-500">
      Security Status: <span className={isExpired ? 'text-brand-terracotta' : 'text-brand-green'}>
        {isExpired ? 'Expired' : 'Pending'}
      </span>
    </div>
  );
}

function TimerLabel({ minutes, isExpired }: { minutes: number | null; isExpired: boolean }) {
  if (isExpired || minutes === null || minutes <= 0) return null;

  return (
    <p className="mt-8 artisan-meta-tiny text-brand-terracotta font-bold animate-pulse">
      Expires in {minutes} {minutes === 1 ? 'minute' : 'minutes'}
    </p>
  );
}

function VouchPendingPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()

  const { data: membership, isLoading } = useQuery({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('neighborhood_memberships')
        .select('id, vouch_verification_code, vouch_code_expires_at, status')
        .eq('profile_id', profile?.id)
        .eq('status', 'pending_second_vouch')
        .maybeSingle()

      if (error) throw error
      return data
    },
  })

  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)

  // TODO: navigate to dashboard when vouch is successful
  useEffect(() => {
    if (!membership || membership?.status !== 'active') return
    navigate({ to: '/' })
  }, [membership, navigate])

  useEffect(() => {
    if (!membership?.vouch_code_expires_at) return
    const expiry = new Date(membership.vouch_code_expires_at).getTime()
    
    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.round((expiry - now) / 60000))
      setMinutesRemaining(diff)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 30000)
    return () => clearInterval(interval)
  }, [membership?.vouch_code_expires_at])

  const requestVouch = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('request_vouch_handshake')
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-membership'] })
      await router.invalidate()
    },
  })

  if (isLoading) return (
    <div className="artisan-page-focus flex items-center justify-center">
      <div className="loading-focus-state">
        <div className="spinner-brand"></div>
        <p className="artisan-meta-tiny">Verifying Security Status...</p>
      </div>
    </div>
  )

  const activeCode = membership?.vouch_verification_code
  const isExpired = activeCode && !isLoading && !minutesRemaining
  const showCode = (!activeCode && !isLoading) || isExpired

  return (
    <div className="artisan-page-focus pt-12 pb-20 px-6">
      <div className="artisan-container-sm">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.png" 
            alt="LocalLoop" 
            className="h-16 w-auto mb-3"
          />
          <span className="text-2xl font-bold text-brand-green">LocalLoop</span>
        </div>
        
        <header className="artisan-header">
          <SecurityBadge isExpired={isExpired} />
          <h1 className="artisan-header-title">Verification Pass</h1>
          {isExpired 
              ? (
              <p className="artisan-header-description">Your security code has expired. Please generate a new one.</p>)
              : <p className="artisan-header-description">
                  We were unable to determine your location. Please present this code to a verified neighbor.
                </p>
          }
        </header>

        <div className={`artisan-card transition-colors duration-500 ${isExpired ? 'border-brand-terracotta' : 'border-brand-green'}`}>
          <div className="artisan-card-inner p-4 text-center">
            <span className="artisan-meta-tiny mb-6 uppercase tracking-widest block">
              Resident Security Code
            </span>
            
            {/* Restored the Passcode component usage */}
            <Passcode code={activeCode} isExpired={isExpired} />
            
            <TimerLabel minutes={minutesRemaining} isExpired={isExpired} />

            {showCode && (
              <button 
                onClick={() => requestVouch.mutate()}
                disabled={requestVouch.isPending}
                className="btn-primary mt-8"
              >
                {requestVouch.isPending ? 'Generating...' : 'Generate New Code'}
              </button>
            )}
          </div>
        </div>

        {!isExpired && (
          <div className="mt-12 space-y-6 text-center animate-in fade-in">
            <button 
              onClick={() => requestVouch.mutate()}
              disabled={requestVouch.isPending}
              className="link-standard mx-auto border-b border-brand-green pb-1"
            >
              {requestVouch.isPending ? 'Refreshing...' : 'Reset Security Code'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}