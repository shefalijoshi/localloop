import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { 
  ChevronLeft, 
  MapPin, 
  Clock, 
  Phone, 
  Mail, 
  CircleQuestionMark,
  CircleCheck,
  CircleX,
  Brain,
  BadgeAlert,
  Calendar,
  NotebookText
} from 'lucide-react'
import { addMinutes, format, formatDuration, intervalToDuration } from 'date-fns'
import { CATEGORY_INTENT } from '../lib/categoryIntent'

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
      const {name, size, temperament, special_needs} = data.snapshot_data;
      const dataWithHelperProfile = {
        ...data,
        display_name: name,
        size,
        temperament,
        special_needs
      }
      return dataWithHelperProfile
    }
  })

  useEffect(() => {
    const channel = supabase
      .channel('public:offers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers' },
        () => {
          // Invalidate the feed query to trigger a refresh of the counts
          queryClient.invalidateQueries({ queryKey: ['request_offers', 'my_offer'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const isOwner = request?.seeker_id === profile?.id

  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ['request_offers', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          profiles:helper_id(display_name)
        `)
        .eq('request_id', requestId)
        .eq('status', 'pending')
      if (error) throw error
      return data
    },
    enabled: !!isOwner
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

  const acceptOfferMutation = useMutation({
    mutationFn: async (targetOfferId: string) => {
      const { error } = await supabase.rpc('accept_neighborhood_offer', {
        target_offer_id: targetOfferId
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
      queryClient.invalidateQueries({ queryKey: ['request_offers', requestId] })
      // Redirect to dashboard or a success view
      navigate({ to: '/dashboard' })
    },
    onError: (err: any) => alert(err.message)
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

  if (requestLoading || offerLoading || (isOwner && offersLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2]">
        <div className="h-8 w-8 border-4 border-[#4A5D4E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!request) return <div className="p-8 text-center font-serif italic text-[#6B6658]">Request not found.</div>

  const category = CATEGORY_INTENT.find(c => c.id === request.category_id);
  const action = category?.actions.find(a => a.id === request.action_id);

  const actionLabel = action?.label || '';

  let heading = request?.display_name || '';
  if (actionLabel) {
    heading = heading ? `${heading} - ${actionLabel}` : `${actionLabel}`;
  }
  if (!heading) {
    heading = request.request_type === 'item' ? 'Item Requested' : 'Service Requested';
  }

  const startTime = new Date(request.timeframe);
  const endTime = addMinutes(startTime, request.duration || 0);

  const isExpired = new Date(request.expires_at) < new Date()
  const isActive = request.status === 'active'
  const isCustomRequest = request.action_id === 'custom_service' || request.action_id === 'custom_item'

  return (
    <div className="artisan-page-focus">
      <div className="artisan-container-large">
        {/* Navigation */}
        <button 
          onClick={() => navigate({ to: '/dashboard' })}
          className="nav-link-back"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <header className="mb-4 text-center">
          <h2 className="artisan-header-title">{heading}</h2>
          <p className="artisan-meta-tiny !text-brand-muted tracking-widest">
            {category?.label}
          </p>
          {isCustomRequest && request.details && !actionLabel && (
            <q className="text-brand-text mt-1">
              {request.details}
            </q>
          )}
        </header>

        {/* Action Area */}
        <div className="mt-2">
          {isOwner ? (
            <div className="space-y-4">
              {offers?.length !== 0 && (<h2 className="text-label">
                Neighbors Available ({offers?.length || 0})
              </h2>)}
              {offers?.map((offer: any) => (
                <div key={offer.id} className="artisan-card p-6">
                  <div className="flex justify-between items-start">
                    <h3 className="text-md">{offer.profiles?.display_name}</h3>
                    <button 
                      disabled={acceptOfferMutation.isPending}
                      onClick={() => acceptOfferMutation.mutate(offer.id)}
                      className="px-4 py-2 bg-[#4A5D4E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-[#3d4d40] transition-colors flex items-center gap-2"
                    >
                      {acceptOfferMutation.isPending ? 'Accepting...' : 'Accept'}
                    </button>
                  </div>
                  <div className="detail-row mt-2 pt-2 border-t border-brand-stone">
                    {offer.note && (
                      <q className="text-label">{offer.note}</q>
                    )}
                  </div>
                </div>
              ))}
              {offers?.length === 0 && (
                <div className="alert-success border-2 border-dashed py-2">
                  <p className="alert-body italic opacity-80 px-8">
                    "Offers to help will appear here."
                  </p>
                </div>
              )}
            </div>
          ) : existingOffer ? (
            <div className="artisan-card bg-brand-green">
              {existingOffer.status === 'pending' && (
                <div className='detail-row justify-center'>
                  <div className="icon-box">
                    <CircleQuestionMark className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg mb-1">Offer Pending</h3>
                    <p className="artisan-meta-tiny text-white">Waiting for a response.</p>
                  </div>
                </div>
              )}
              {existingOffer.status === 'accepted' && (
                <div className='detail-row justify-center'>
                  <div className="icon-box">
                    <CircleCheck className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg mb-1">Offer accepted</h3>
                    <p className="artisan-meta-tiny text-white">Enjoy assisting your neighbor!</p>
                  </div>
                </div>
              )}
              {existingOffer.status === 'declined' && (
                <div className='detail-row justify-center'>
                  <div className="icon-box">
                    <CircleX className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg mb-1">Offer declined</h3>
                    <p className="artisan-meta-tiny text-white">Someone else is assisting your neighbor.</p>
                  </div>
                </div>
              )}
            </div>
          ) : !isActive || isExpired ? (
            <div className="alert-success border-2 py-2">
              <p className="alert-body italic px-8">
                This request is no longer available.
              </p>
            </div>
          ) : !showOfferForm ? (
            <button 
              onClick={() => setShowOfferForm(true)}
              className="btn-primary"
            >
              I'm Available to Help
            </button>
          ) : (//Show Offer form so helper can provide offer details
            <div className="artisan-card p-6 bg-white shadow-xl animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-6">
                <div>
                  <label className="text-label">Optional Note</label>
                  <textarea 
                    className="artisan-input min-h-[100px] mt-2 py-4 resize-none text-sm"
                    placeholder="Share offer related message..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-label">Contact to Share</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setSharePhone(!sharePhone)}
                      className={`artisan-toggle-btn flex items-center justify-center gap-2 ${
                        sharePhone ? 'artisan-toggle-btn-active' : 'artisan-toggle-btn-inactive'
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-brand-white">Phone</span>
                    </button>
                    <button 
                      onClick={() => setShareEmail(!shareEmail)}
                      className={`artisan-toggle-btn flex items-center justify-center gap-2 ${
                        shareEmail ? 'artisan-toggle-btn-active' : 'artisan-toggle-btn-inactive'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      <span className="text-brand-white">Email</span>
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
                    {submitOfferMutation.isPending ? 'Submitting...' : 'Confirm Offer'}
                  </button>
                  <button 
                    onClick={() => setShowOfferForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4 mt-2">
          <div className="artisan-card mb-2">
            <div className="artisan-card-inner">
              {!isCustomRequest && request.details && (
                <div className="detail-row">
                  <div className="icon-box">
                    <NotebookText className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Extra Details</p>
                    <q className="text-brand-dark font-medium">
                      {request.details}
                    </q>
                </div>
              </div>)}
              {/* 1. Timeframe Section */}
              <div className="detail-row">
                <div className="icon-box">
                  <Calendar className="w-4 h-4 text-brand-green" />
                </div>
                {request.request_type === 'item' && (
                  <div>
                    <p className="text-label block mb-3">Pick up and return</p>
                    <p className="text-brand-dark font-medium">
                    {format(startTime, 'MMM d')} - {format(endTime, 'MMM d')}
                    </p>
                  </div>)
                }
                {request.request_type === 'service' && (
                  <div>
                    <p className="text-label block mb-3">Starting</p>
                    <p className="text-brand-dark font-medium">
                    {format(startTime, 'MMM d HH:mm a')}
                    </p>
                  </div>)
                }
              </div>
              {/* 2. Duration Section */}
              <div className="detail-row">
                <div className="icon-box">
                  <Clock className="w-4 h-4 text-brand-green" />
                </div>
                <div>
                  <p className="text-label block mb-3">Estimated Time</p>
                  <p className="text-brand-dark font-medium">{formatDuration(intervalToDuration({start: 0, end: request.duration * 60 * 1000}), { delimiter: ', ' })}</p>
                </div>
              </div>
              {/* 3. Location Section */}
                <div className="detail-row">
                  <div className="icon-box">
                    <MapPin className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Address (Verified)</p>
                    <p className="text-brand-dark font-medium">
                      {request.street_name}
                    </p>
                    <p className="artisan-meta-tiny mt-2">Full address shared once accepted</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Personality Card */}
          {request.temperament && request.temperament.length > 0 && (
            <div className="artisan-card mb-2">
              <div className="artisan-card-inner">
                <div className="detail-row">
                  <div className="icon-box">
                    <Brain className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Temperament</p>
                    <div className="text-brand-dark font-medium">
                      {request.temperament.map((trait: string) => (
                        <span key={trait} className="badge-pill">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Special Needs Card */}
          {request.special_needs && (
            <div className="artisan-card">
              <div className="artisan-card-inner">
                <div className="detail-row">
                  <div className="icon-box">
                    <BadgeAlert className="w-4 h-4 text-brand-terracotta" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Care Instructions</p>
                    <p className="text-brand-dark font-medium">
                      "{request.special_needs}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}