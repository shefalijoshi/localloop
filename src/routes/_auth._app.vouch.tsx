import { PasscodeInput } from '../components/PasscodeInput'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ChevronLeft } from 'lucide-react'
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
      
      // Refresh local state and global context
      await queryClient.invalidateQueries()
      await router.invalidate()
    },
    onError: (error: any) => {
      setError(`Error verifying code: ${error.message}`);
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Ensure we only submit if the code is complete
    if (code.length === 6 && !vouchMutation.isPending) {
      vouchMutation.mutate(code)
    }
  }

  // Helper to handle input and keep it clean
  const handleInputChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length <= 6) {
      setCode(cleaned)
    }
  }

  const approveJoinRequest = useMutation({
    mutationFn: async (id: string) => {
      setError(null);
      // Calls the RPC we defined to activate the neighbor
      const { error } = await supabase.rpc('approve_join_request', {
        p_membership_id: id,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setIsSuccess(true)
      
      // Refresh local state and global context
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

  // SUCCESS VIEW
  if (isSuccess) {
    return (
      <div className="artisan-page-focus">
        <div className="artisan-container-sm max-w-sm">
          <h1 className="artisan-header-title">Neighborhood Expanded</h1>
          <p className="artisan-header-description mb-2">"Their residency is now verified by your word."</p>
          <button onClick={() => navigate({ to: '/' })} className="btn-primary px-8">Finish</button>
        </div>
      </div>
    )
  }

  return (
    <div className="artisan-page-focus">
      <div className="artisan-container-large">
        <button onClick={() => navigate({ to: '/dashboard' })} className="nav-link-back">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <header className="artisan-header">
          <div className="badge-pill mb-4">
            Security: Handshake
          </div>
          <h1 className="artisan-header-title">Vouch for Neighbor(s)</h1>
        </header>
        {error && (
          <div className="alert-error mb-8 animate-in border-dashed">
            <span className="alert-title mb-0">{error}</span>
          </div>
        )}
        {/* The Unified Artisan Card */}
        {joinRequests.length === 0 ? (
          <div className="alert-info border-2 border-dashed mb-4 py-4">
            <p className="alert-body italic opacity-80 px-8 text-center">
              "When new neighbors want to join, their requests will appear here."
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <h2 className="text-label mb-2">Requests to join</h2>
            {joinRequests.map((req: JoinRequestProps) => 
            <VouchRequestCard key={req.membership_id} 
              disabled={vouchMutation.isPending}
              request={req} 
              currentTime={now.getTime()} 
              onApprove={() => approveJoinRequest.mutate(req.membership_id)}/>)}
          </div>
        )}
        <h2 className="text-label mt-6 mb-2">Enter a security code</h2>
        <div className="artisan-card">
          <div className="artisan-card-inner p-2 text-center">
            <form onSubmit={handleSubmit} className="space-y-10">
              <PasscodeInput 
                value={code} 
                onChange={handleInputChange} 
                disabled={vouchMutation.isPending} 
              />
  
              <button
                type="submit"
                disabled={code.length < 6 || vouchMutation.isPending}
                className="btn-primary mt-8"
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