import { Passcode } from '../components/Passcode'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/_auth/vouch-pending')({
  beforeLoad: ({ context }) => {
    // If you are active, you shouldn't be in the waiting room.
    if (context.membershipStatus === 'active') {
      throw redirect({ to: '/' }) // Go to Traffic Cop (will send to Dashboard)
    }
  },
  component: VouchPendingPage,
})

// Displays the current security status in an elegant, context-aware pill
function SecurityBadge({ isExpired }: { isExpired: boolean }) {
  const status = isExpired ? 'Expired' : 'Pending';
  
  return (
    <div className="inline-block px-3 py-1 bg-[#EBE7DE] rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-[#6B6658] mb-4 animate-in fade-in duration-500">
      Security Status: {status}
    </div>
  );
}

interface VouchActionProps {
  isExpired: boolean;
  isPending: boolean;
  onAction: () => void;
}

// Manages the call-to-action based on the security state
function VouchAction({ isExpired, isPending, onAction }: VouchActionProps) {
  if (isExpired) {
    return (
      <button 
        onClick={onAction}
        disabled={isPending}
        className="mt-8 btn-primary w-full py-3 text-xs shadow-xl shadow-[#BC6C4D]/10"
      >
        {isPending ? 'Generating...' : 'Generate New Code'}
      </button>
    );
  }

  return (
    <div className="mt-12 space-y-6 animate-in fade-in">
      <p className="text-[11px] text-[#A09B8E] leading-relaxed italic px-8">
        "Present this code to a verified neighbor to authenticate your profile."
      </p>
      <button 
        onClick={onAction}
        disabled={isPending}
        className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D4E] border-b border-[#4A5D4E] pb-1 transition-opacity hover:opacity-70"
      >
        {isPending ? 'Refreshing...' : 'Reset Security Code'}
      </button>
    </div>
  );
}

// Handles the elegant display of the remaining time
function TimerLabel({ minutes, isExpired }: { minutes: number | null; isExpired: boolean }) {
  if (isExpired || minutes === null || minutes <= 0) return null;

  return (
    <p className="mt-8 text-[10px] uppercase tracking-widest text-[#BC6C4D] font-bold animate-pulse">
      Expires in {minutes} {minutes === 1 ? 'minute' : 'minutes'}
    </p>
  );
}

function VouchPendingPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter() // Access the router to trigger global refreshes
  const { profile } = Route.useRouteContext()

  // 1. Fetch current membership status
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

  // We use state to track the "now" value, initialized to null to avoid hydration flickers
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!membership?.vouch_code_expires_at) return

    const expiry = new Date(membership.vouch_code_expires_at).getTime()
    
    const updateTimer = () => {
      const now = Date.now() // Impure call is now safely inside an effect
      const diff = Math.max(0, Math.round((expiry - now) / 60000))
      setMinutesRemaining(diff)
    }

    updateTimer() // Initial check
    const interval = setInterval(updateTimer, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [membership?.vouch_code_expires_at])
  
  // 2. REALTIME LISTENER: Listen for the moment a neighbor vouches for you
  useEffect(() => {
    if (!membership?.id) return

    const channel = supabase
    .channel(`vouch-status-${profile?.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'neighborhood_memberships',
        filter: `profile_id=eq.${profile?.id}`, // Correct column name
      },
      async (payload) => {
        if (payload.new.status === 'active') {
          await queryClient.invalidateQueries()
          await router.invalidate()
          window.location.replace('/') // Redirect to dashboard
        }
      }
    )
    .subscribe()

  return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, membership?.id, navigate, queryClient, router])

  // 3. Mutation for code generation (The "Handshake")
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

  if (isLoading) return <div className="p-8 text-center animate-pulse text-[#6B6658]">Verifying Security Status...</div>

  const activeCode = membership?.vouch_verification_code
  // Use the timer state to determine expiration
  const isExpired = minutesRemaining === 0 || (!activeCode && !isLoading)

  return (
    <div className="min-h-screen bg-[#F9F7F2] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm">
        
      <header className="mb-10">
        <SecurityBadge isExpired={isExpired} />
        
        <h1 className="text-3xl font-serif text-[#2D2D2D]">Verification Pass</h1>
        
        <p className="mt-4 text-sm text-[#6B6658] leading-relaxed px-4">
          {isExpired 
            ? "Your security code has expired. Please generate a new one."
            : "A verified neighbor must confirm your residency in person."}
        </p>
      </header>

        <div className={`artisan-card p-2 bg-white border-t-4 ${isExpired ? 'border-[#BC6C4D]' : 'border-[#4A5D4E]'}`}>
          <div className="bg-[#F2F0E9]/50 rounded-[1.8rem] py-10 px-6">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#A09B8E] block mb-6">
              Resident Security Code
            </span>
            
            <Passcode code={activeCode} isExpired={isExpired} />
            
            <TimerLabel minutes={minutesRemaining} isExpired={isExpired} />

            {isExpired && (
              <VouchAction 
                isExpired={true} 
                isPending={requestVouch.isPending} 
                onAction={() => requestVouch.mutate()} 
              />
            )}
          </div>
        </div>

        {!isExpired && (
          <div className="mt-12 space-y-6">
            <p className="text-[11px] text-[#A09B8E] leading-relaxed italic px-8">
              "Present this code to a verified neighbor to authenticate your profile."
            </p>
            <button 
              onClick={() => requestVouch.mutate()}
              className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D4E] border-b border-[#4A5D4E] pb-1"
            >
              Reset Security Code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}