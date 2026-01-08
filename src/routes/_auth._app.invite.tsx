import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/_auth/_app/invite')({
  component: InvitePage,
})

function InvitePage() {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  
  const { profile } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const router = useRouter()

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
      <div className="artisan-container-sm">
        
        <header className="artisan-header">
          <div className="badge-pill mb-4">Network Expansion</div>
          <h1 className="artisan-header-title">Invite a Neighbor</h1>
          <p className="artisan-header-description">
            Invite codes allow new residents to join your specific neighborhood boundary.
          </p>
        </header>

        <div className="artisan-card border-t-4 border-brand-green">
          <div className="artisan-card-inner">
            {!inviteCode ? (
              <div className="space-y-6 w-full">
                <p className="text-sm text-brand-text italic leading-relaxed px-4">
                  "Each code is valid for 24 hours and can be used to authenticate one new household."
                </p>
                <button
                  onClick={() => createInvite.mutate()}
                  disabled={createInvite.isPending}
                  className="btn-primary"
                >
                  {createInvite.isPending ? 'GENERATING...' : 'CREATE INVITE CODE'}
                </button>
              </div>
            ) : (
              <div className="space-y-8 w-full animate-in zoom-in-95 duration-300">
                <div>
                  <label className="text-label block mb-4">Your Unique Code</label>
                  <div className="artisan-code-display">
                    <span className="text-passcode">{inviteCode}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCopy}
                    className={`btn-outline ${
                      isCopied 
                        ? 'bg-brand-green text-white border-brand-green shadow-lg shadow-brand-green/10' 
                        : 'bg-white border-brand-border text-brand-green hover:bg-brand-stone'
                    }`}
                  >
                    {isCopied ? 'COPIED TO CLIPBOARD' : 'COPY CODE'}
                  </button>
                  
                  <button
                    onClick={() => setInviteCode(null)}
                    className="link-standard w-full py-2 underline underline-offset-4"
                  >
                    Create another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {createInvite.isError && (
          <div className="alert-error">
            <span className="alert-title text-brand-terracotta">Generation Failed</span>
            <span className="alert-body">Please check your connection and try again.</span>
          </div>
        )}

        <div className="flex justify-center mt-12">
          <button
            onClick={() => router.navigate({ to: '/dashboard' })}
            className="link-standard"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}