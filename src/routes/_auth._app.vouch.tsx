import { PasscodeInput } from '../components/PasscodeInput'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertTriangle, ChevronLeft, Key, Verified } from 'lucide-react'
import { isAfter } from 'date-fns/isAfter'
import { VouchRequestCard, type JoinRequestProps } from '../components/VouchRequestCard'

export const Route = createFileRoute('/_auth/_app/vouch')({
  component: VouchEntryPage,
})

function VouchEntryPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile } = Route.useRouteContext()
  
  const [code, setCode] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [now, setNow] = useState(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const { data: join_requests } = useQuery({
    queryKey: ['join_requests_feed'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_join_requests')
      if (error) throw error
      return data
    }
  })

  useEffect(() => {
    const channel = supabase
      .channel('join_requests_feed_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'neighborhood_memberships',
        filter: `neighborhood_id=eq.${profile?.neighborhood_id}` 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['join_requests_feed'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, profile?.neighborhood_id])

  const vouchMutation = useMutation({
    mutationFn: async (enteredCode: string) => {
      setError(null);
      const { error } = await supabase.rpc('vouch_via_handshake', {
        entered_code: enteredCode,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setIsSuccess(true)
      
      await queryClient.invalidateQueries()
      await router.invalidate()
    },
    onError: (error: any) => {
      setError(`Error verifying code: ${error.message}`);
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length === 6 && !vouchMutation.isPending) {
      vouchMutation.mutate(code)
    }
  }

  const handleInputChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length <= 6) {
      setCode(cleaned)
    }
  }

  const approveJoinRequest = useMutation({
    mutationFn: async (id: string) => {
      setError(null);
      const { error } = await supabase.rpc('approve_join_request', {
        p_membership_id: id,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setIsSuccess(true)
      
      await queryClient.invalidateQueries()
      await router.invalidate()
    },
    onError: (error: any) => {
      setError(`Error verifying code: ${error.message}`);
    }
  })

  const joinRequests = join_requests?.filter((r: any) => 
    isAfter(new Date(r.vouch_code_expires_at), now)
  ) || []

  return (
    <div className="artisan-page-focus">
      <div className="artisan-container-large">
        <button onClick={() => navigate({ to: '/dashboard' })} className="nav-link-back">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <header className="artisan-header">
          <div className="mb-4 font-mono flex gap-2 justify-center items-center">
            <div className='gps-indicator'>
              <span className='gps-indicator-dot'></span>
            </div>
            <p>Security: Handshake</p>
          </div>
          <h1 className="artisan-header-title">Vouch for Neighbor(s)</h1>
        </header>
        {error && (
          <div className="status-card-warning animate-in">
            <AlertTriangle className="w-5 h-5 text-brand-terracotta shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-label text-brand-terracotta/80 mb-1">Heads up</h4>
              <p className="text-sm font-bold tracking-tight text-brand-dark leading-tight">
                {error}
              </p>
            </div>
          </div>
        )}
        {isSuccess && (
          <div className="status-card-active animate-in">
            <Verified className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-label text-brand-terracotta/80 mb-1">Neighborhood Expanded</h3>
              <p className="text-sm font-bold tracking-tight text-brand-dark leading-tight">
              Their residency is now verified by your word.
              </p>
            </div>
          </div>
        )}
        {joinRequests.length === 0 ? (
          <div className="artisan-card border-brand-stone mb-4 py-4 text-center">
            <div className="text-explanation">
              When new neighbors want to join, their requests will appear here.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-label mb-2">Requests to join</h2>
            <div className="grid grid-cols-1 gap-4">
            {joinRequests.map((req: JoinRequestProps) => 
            <VouchRequestCard key={req.membership_id} 
              disabled={vouchMutation.isPending}
              request={req} 
              currentTime={now.getTime()} 
              onApprove={() => approveJoinRequest.mutate(req.membership_id)}/>)}
            </div>
          </div>
        )}
        <div className="artisan-card border-brand-green mt-6">
          <div className="text-center py-4 border-b border-brand-stone/50">
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="h-10 w-10 bg-brand-green/10 rounded-full flex items-center justify-center">
                <Key className="w-5 h-5 text-brand-green" />
              </div>
              <p className="text-sm font-medium text-brand-muted leading-relaxed">Use a security code from a neighbor.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-10">
              <PasscodeInput 
                value={code} 
                onChange={handleInputChange} 
                disabled={vouchMutation.isPending} 
              />

              <button
                type="submit"
                disabled={code.length < 6 || vouchMutation.isPending}
                className="btn-primary"
              >
                {vouchMutation.isPending ? 'Verifying...' : 'Authorize Access'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}