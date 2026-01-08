import { PasscodeInput } from '../components/PasscodeInput'
import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/_auth/_app/vouch')({
  component: VouchEntryPage,
})

function VouchEntryPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [code, setCode] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const vouchMutation = useMutation({
    mutationFn: async (enteredCode: string) => {
      // Calls the RPC we defined to activate the neighbor
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

  // SUCCESS VIEW
  if (isSuccess) {
    return (
      <div className="artisan-page-focus">
        <div className="artisan-container-sm max-w-sm">
          <h1 className="artisan-header-title">Neighborhood Expanded</h1>
          <p className="artisan-header-description">"Their residency is now verified by your word."</p>
          <button onClick={() => navigate({ to: '/' })} className="btn-primary px-8">Finish</button>
        </div>
      </div>
    )
  }

  return (
    <div className="artisan-page-focus">
      <div className="artisan-container-sm max-w-sm">
        <header className="artisan-header">
          <div className="badge-pill mb-4">
            Security: Handshake
          </div>
          <h1 className="artisan-header-title">Vouch for Neighbor</h1>
        </header>
  
        {/* The Unified Artisan Card */}
        <div className="artisan-card border-t-4 border-brand-green">
          <div className="artisan-card-inner text-center">
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
  
        <button 
            onClick={() => navigate({ to: '/dashboard' })} 
            className="nav-link-back w-full justify-center mt-6"
          >
            Cancel and Return
        </button>
      </div>
    </div>
  )
}