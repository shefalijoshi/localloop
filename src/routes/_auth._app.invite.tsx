import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, ChevronLeft } from 'lucide-react'

export const Route = createFileRoute('/_auth/_app/invite')({
  component: InvitePage,
})

function InvitePage() {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  
  const { profile } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const router = useRouter()
  const navigate = useNavigate()

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!profile?.neighborhood_id) throw new Error('Neighborhood context missing')

      const { data: code, error: genError } = await supabase.rpc('generate_invite_code')
      if (genError) throw genError

      const { error: insertError } = await supabase
        .from('invite_codes')
        .insert({
          code: code,
          neighborhood_id: profile.neighborhood_id,
          created_by: profile.id,
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), 
        })

      if (insertError) throw insertError
      return code
    },
    onSuccess: async (code) => {
      setInviteCode(code)
      await queryClient.invalidateQueries({ queryKey: ['invites'] })
      await router.invalidate()
    }
  })

  const handleCopy = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

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
            <p>Network Expansion</p>
          </div>
          <h1 className="artisan-header-title">Invite a Neighbor</h1>
        </header>

        {createInvite.isError && (
          <div className="status-card-warning animate-reveal">
            <AlertTriangle className="w-5 h-5 text-brand-terracotta shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-label text-brand-terracotta/80 mb-1">Code generation failed</h4>
              <p className="text-sm font-bold tracking-tight text-brand-dark leading-tight">
                Please try again.
              </p>
          </div>
        </div>
        )}

        <div className="artisan-card border-brand-green">
          <div className="artisan-card-inner">
            {!inviteCode ? (
              <div className="space-y-6 w-full">
                <p className="text-explanation">
                  Invite codes can be used to authenticate one new neighbor in your specific neighborhood boundary. Each code is valid for <em>24 hours</em>.
                </p>
                {!createInvite.isPending && <button
                  onClick={() => createInvite.mutate()}
                  disabled={createInvite.isPending}
                  className="btn-primary"
                >Create invite code</button>}
                {createInvite.isPending && <div className="mb-4 font-mono flex gap-2 justify-center items-center">
                  <div className='gps-indicator'>
                    <span className='gps-indicator-dot'></span>
                  </div>
                  <p>Generating code...</p>
                </div>}
              </div>
            ) : (
              <div className="space-y-8 w-full animate-in zoom-in-95 duration-300">
                <div>
                  <label className="block mb-4 text-label">Your Unique Code</label>
                  <div className="artisan-input font-mono">
                    <span>{inviteCode}</span>
                  </div>
                  <div className="artisan-meta-tiny text-brand-terracotta text-right">Expires: 24 Hours</div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCopy}
                    className={`${isCopied ? 'btn-primary' : 'btn-secondary'}`}>
                    {isCopied ? 'Copied to clipboard' : 'Copy code'}
                  </button>
                  
                  <button
                    onClick={() => setInviteCode(null)}
                    className="btn-tertiary">
                    Create another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}