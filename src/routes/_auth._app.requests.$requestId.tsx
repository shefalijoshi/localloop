import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { 
  ChevronLeft, 
  MapPin, 
  Clock, 
  Dog, 
  AlertCircle, 
  Phone, 
  Mail, 
  CheckCircle2 
} from 'lucide-react'
import { format } from 'date-fns'

export const Route = createFileRoute('/_auth/_app/requests/$requestId')({
  component: RequestDetailComponent,
})

function RequestDetailComponent() {
  const { requestId } = Route.useParams()
  const { profile } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // --- UI State ---
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [note, setNote] = useState('')
  const [sharePhone, setSharePhone] = useState(false)
  const [shareEmail, setShareEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Fetch Request Details (No Owner Profile Join) ---
  const { data: request, isLoading: requestLoading } = useQuery({
    queryKey: ['request', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .single()
      if (error) throw error
      return data
    }
  })

  // --- Check for existing offer from this helper ---
  const { data: existingOffer, isLoading: offerLoading } = useQuery({
    queryKey: ['my_offer', requestId, profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('request_id', requestId)
        .eq('helper_id', profile?.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile?.id
  })

  // --- Mutation: Submit Offer ---
  const submitOfferMutation = useMutation({
    mutationFn: async () => {
      if (!sharePhone && !shareEmail) {
        throw new Error("Please share at least one contact method.")
      }
      
      const { error } = await supabase
        .from('offers')
        .insert({
          request_id: requestId,
          helper_id: profile?.id,
          note: note || null,
          share_phone: sharePhone,
          share_email: shareEmail,
          status: 'pending'
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_offer', requestId] })
      window.location.replace('/')
    },
    onError: (err: any) => setError(err.message)
  })

  if (requestLoading || offerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2]">
        <div className="h-8 w-8 border-4 border-[#4A5D4E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!request) return <div className="p-8 text-center font-serif italic text-[#6B6658]">Request not found.</div>

  const isOwner = request.seeker_id === profile?.id
  const isExpired = new Date(request.expires_at) < new Date()
  const isActive = request.status === 'active'

  return (
    <div className="min-h-screen bg-[#F9F7F2] pb-20">
      <div className="px-6 pt-8 max-w-md mx-auto">
        {/* Navigation */}
        <button 
          onClick={() => navigate({ to: '/dashboard' })}
          className="flex items-center gap-2 text-[#A09B8E] hover:text-[#4A5D4E] transition-colors mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Back to Feed</span>
        </button>

        {/* Dog Profile Hero */}
        <header className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="h-24 w-24 bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden border-4 border-white mx-auto">
              {request.dog_photo ? (
                <img src={request.dog_photo} alt={request.dog_name} className="h-full w-full object-cover" />
              ) : (
                <Dog className="w-10 h-10 text-[#EBE7DE]" />
              )}
            </div>
          </div>
          <h1 className="text-3xl font-serif text-[#2D2D2D] mb-1">{request.dog_name}</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#A09B8E]">
            {request.dog_size} • {request.duration}m Walk
          </p>
        </header>

        <div className="space-y-4">
          {/* Logistics Card */}
          <div className="artisan-card p-6 bg-white space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#F2F0E9] rounded-xl">
                <MapPin className="w-4 h-4 text-[#4A5D4E]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] mb-0.5">Location</p>
                <p className="text-sm font-medium text-[#2D2D2D]">{request.street_name}</p>
                <p className="text-[9px] text-[#A09B8E] italic">Full address shared once accepted</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#F2F0E9] rounded-xl">
                <Clock className="w-4 h-4 text-[#4A5D4E]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] mb-0.5">Timeframe</p>
                <p className="text-sm font-medium text-[#2D2D2D]">
                  {request.timeframe ? format(new Date(request.timeframe), 'p') : 'ASAP'}
                </p>
              </div>
            </div>
          </div>

          {/* Personality Card */}
          {request.temperament && request.temperament.length > 0 && (
            <div className="artisan-card p-6 bg-white">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] mb-3">Temperament</p>
              <div className="flex flex-wrap gap-2">
                {request.temperament.map((trait: string) => (
                  <span key={trait} className="px-3 py-1 bg-[#F9F7F2] border border-[#EBE7DE] rounded-full text-[10px] font-bold uppercase text-[#6B6658]">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Special Needs Card */}
          {request.special_needs && (
            <div className="artisan-card p-6 bg-white border-l-4 border-[#BC6C4D]/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3 h-3 text-[#BC6C4D]" />
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#BC6C4D]">Care Instructions</p>
              </div>
              <p className="text-sm text-[#6B6658] leading-relaxed italic">
                "{request.special_needs}"
              </p>
            </div>
          )}

          {/* Action Area */}
          <div className="mt-8">
            {isOwner ? (
              <div className="text-center p-6 bg-[#F2F0E9]/50 rounded-3xl border border-dashed border-[#EBE7DE]">
                <p className="text-[10px] text-[#A09B8E] uppercase tracking-widest font-bold">Your Request</p>
              </div>
            ) : existingOffer ? (
              <div className="artisan-card p-8 bg-[#4A5D4E] text-center shadow-lg shadow-[#4A5D4E]/20">
                <CheckCircle2 className="w-8 h-8 text-white/50 mx-auto mb-3" />
                <h3 className="font-serif text-white text-lg mb-1">Offer Pending</h3>
                <p className="text-white/70 text-xs">Waiting for the owner to respond.</p>
              </div>
            ) : !isActive || isExpired ? (
              <div className="text-center p-6 bg-[#F2F0E9] rounded-3xl">
                <p className="text-sm text-[#A09B8E]">This request is no longer available.</p>
              </div>
            ) : !showOfferForm ? (
              <button 
                onClick={() => setShowOfferForm(true)}
                className="btn-primary w-full shadow-xl shadow-[#4A5D4E]/10"
              >
                I'm Available to Help
              </button>
            ) : (
              <div className="artisan-card p-6 bg-white shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-serif text-xl mb-6 text-[#2D2D2D]">Offer Details</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-2 ml-1">Optional Note</label>
                    <textarea 
                      className="artisan-input text-sm min-h-[100px] py-3 resize-none"
                      placeholder="Share a quick message..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-3 ml-1">Contact to Share</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setSharePhone(!sharePhone)}
                        className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                          sharePhone ? 'border-[#4A5D4E] bg-[#4A5D4E] text-white' : 'border-[#F2F0E9] bg-white text-[#A09B8E]'
                        }`}
                      >
                        <Phone className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Phone</span>
                      </button>
                      <button 
                        onClick={() => setShareEmail(!shareEmail)}
                        className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                          shareEmail ? 'border-[#4A5D4E] bg-[#4A5D4E] text-white' : 'border-[#F2F0E9] bg-white text-[#A09B8E]'
                        }`}
                      >
                        <Mail className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Email</span>
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-xs text-[#BC6C4D] text-center italic">{error}</p>}

                  <div className="pt-2 space-y-3">
                    <button 
                      disabled={submitOfferMutation.isPending}
                      onClick={() => submitOfferMutation.mutate()}
                      className="btn-primary w-full tracking-[0.2em] text-sm py-4"
                    >
                      {submitOfferMutation.isPending ? 'SUBMITTING...' : 'CONFIRM OFFER'}
                    </button>
                    <button 
                      onClick={() => setShowOfferForm(false)}
                      className="w-full text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}