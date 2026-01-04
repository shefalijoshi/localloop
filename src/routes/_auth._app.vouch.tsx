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
      <div className="min-h-screen bg-[#F9F7F2] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-serif text-[#2D2D2D] mb-4">Neighborhood Expanded</h1>
        <p className="text-[#6B6658] text-sm italic mb-10">"Their residency is now verified by your word."</p>
        <button onClick={() => navigate({ to: '/' })} className="btn-primary px-8">Finish</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        
        <header className="text-center mb-10">
          <div className="inline-block px-3 py-1 bg-[#EBE7DE] rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-[#6B6658] mb-4">
            Security: Handshake
          </div>
          <h1 className="text-3xl font-serif text-[#2D2D2D]">Vouch for Neighbor</h1>
        </header>
  
        {/* The Unified Artisan Card */}
        <div className="artisan-card p-2 bg-white border-t-4 border-[#4A5D4E]">
          <div className="bg-[#F2F0E9]/50 rounded-[1.8rem] py-10 px-6">
            <form onSubmit={handleSubmit} className="space-y-10">
              <PasscodeInput 
                value={code} 
                onChange={handleInputChange} 
                disabled={vouchMutation.isPending} 
              />
  
              <button
                type="submit"
                disabled={code.length < 6 || vouchMutation.isPending}
                className="btn-primary w-full py-4 text-xs tracking-[0.1em] shadow-xl shadow-[#4A5D4E]/10"
              >
                {vouchMutation.isPending ? 'VERIFYING...' : 'AUTHORIZE ACCESS'}
              </button>
            </form>
          </div>
        </div>
  
        <button
          onClick={() => navigate({ to: '/dashboard' })}
          className="mt-8 w-full text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] hover:text-[#6B6658]"
        >
          Cancel and Return
        </button>
      </div>
    </div>
  )
}