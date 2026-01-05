import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, addMinutes } from 'date-fns'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/_auth/_app/create-request')({
  component: CreateRequestComponent,
})

function CreateRequestComponent() {
  const { profile } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // --- Form State ---
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30)
  const [timeframe, setTimeframe] = useState<'now' | 'scheduled'>('now')
  const [scheduledTime, setScheduledTime] = useState<string>('')
  const [walkerPref, setWalkerPref] = useState<'no_preference' | 'prefers_male' | 'prefers_female'>('no_preference')
  const [error, setError] = useState<string | null>(null)

  // --- Fetch Help Details (Dog Profiles) ---
  const { data: helpDetails, isLoading } = useQuery({
    queryKey: ['help_details', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('help_details')
        .select('*')
        .eq('seeker_id', profile?.id)
      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  // --- UI Logic: Calculate Expiry Preview ---
  // Note: Actual calculation happens in the RPC, this is just for the "Calm UI" display
  const getExpiryPreview = () => {
    if (timeframe === 'now') {
      return addMinutes(new Date(), 60)
    }
    if (scheduledTime) {
      return addMinutes(new Date(scheduledTime), -10)
    }
    return addMinutes(new Date(), 60)
  }

  // --- Mutation: Call the RPC ---
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDogId) throw new Error("Please select a dog profile")
      
      const { data, error } = await supabase.rpc('create_walk_request', {
        p_help_detail_id: selectedDogId,
        p_duration: duration,
        p_timeframe_type: timeframe,
        p_scheduled_time: timeframe === 'scheduled' ? new Date(scheduledTime).toISOString() : null,
        p_walker_preference: walkerPref
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      navigate({ to: '/dashboard' })
    },
    onError: (err: any) => setError(err.message)
  })

  if (isLoading) return <div className="p-8 text-center font-serif italic text-[#6B6658]">Loading profiles...</div>

  return (
    <div className="min-h-screen bg-[#F9F7F2] pb-20 pt-8 px-6">
      <div className="max-w-md mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-serif text-[#2D2D2D] mb-2">Request a Walk</h1>
          <p className="text-[#6B6658] text-sm italic">
            Broadcast a request to your neighborhood.
          </p>
        </header>

        {/* 1. Selection: Help Details Cards */}
        <section className="mb-8">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-4 ml-1">
            Who needs a walk?
          </label>
          {helpDetails && helpDetails.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {helpDetails.map((dog) => (
                <button
                  key={dog.id}
                  onClick={() => setSelectedDogId(dog.id)}
                  className={`flex-shrink-0 w-32 artisan-card p-3 transition-all border-2 ${
                    selectedDogId === dog.id 
                      ? 'border-[#4A5D4E] bg-white shadow-md' 
                      : 'border-transparent bg-white/50 opacity-70'
                  }`}
                >
                  <div className="h-16 w-16 bg-[#F2F0E9] rounded-full mx-auto mb-3 flex items-center justify-center overflow-hidden border border-[#EBE7DE]">
                    {dog.photo_url ? (
                      <img src={dog.photo_url} alt={dog.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">🐕</span>
                    )}
                  </div>
                  <p className="text-center font-serif text-[#2D2D2D] text-sm truncate">{dog.name}</p>
                  <p className="text-center text-[9px] text-[#A09B8E] uppercase tracking-tighter">{dog.dog_size}</p>
                </button>
              ))}
              <button
                onClick={() => navigate({ to: '/help-details/create' })}
                className="flex-shrink-0 w-32 artisan-card p-3 border-2 border-dashed border-[#EBE7DE] bg-transparent flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-all"
              >
                <div className="h-10 w-10 rounded-full border border-dashed border-[#A09B8E] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[#A09B8E]" />
                </div>
                <p className="text-[9px] uppercase tracking-widest font-bold text-[#A09B8E]">Add New</p>
              </button>
            </div>
          ) : (
            <div className="artisan-card p-8 text-center bg-[#F2F0E9]/30 border-dashed border-2 border-[#EBE7DE]">
              <p className="text-sm text-[#6B6658] mb-4">No dog profiles yet.</p>
              <button 
                onClick={() => navigate({ to: '/help-details/create' })}
                className="text-[10px] uppercase tracking-widest font-bold text-[#4A5D4E] underline"
              >
                + Create a Profile
              </button>
            </div>
          )}
        </section>

        {/* 2. Configuration (Visible only after selection) */}
        {selectedDogId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="artisan-card p-6 bg-white shadow-sm">
              
              {/* Duration Toggle */}
              <div className="mb-8">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-4 ml-1">Duration</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setDuration(m as any)}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                        duration === m 
                          ? 'border-[#4A5D4E] bg-[#4A5D4E] text-white' 
                          : 'border-[#F2F0E9] text-[#6B6658] hover:border-[#EBE7DE]'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing Selector */}
              <div className="mb-8">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-4 ml-1">When?</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => setTimeframe('now')}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                      timeframe === 'now' 
                        ? 'border-[#4A5D4E] bg-[#4A5D4E] text-white' 
                        : 'border-[#F2F0E9] text-[#6B6658]'
                    }`}
                  >
                    As Soon As Possible
                  </button>
                  <button
                    onClick={() => setTimeframe('scheduled')}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                      timeframe === 'scheduled' 
                        ? 'border-[#4A5D4E] bg-[#4A5D4E] text-white' 
                        : 'border-[#F2F0E9] text-[#6B6658]'
                    }`}
                  >
                    Schedule Later
                  </button>
                </div>
                
                {timeframe === 'scheduled' && (
                  <div className="animate-in zoom-in-95 duration-200">
                    <input
                      type="datetime-local"
                      className="artisan-input w-full text-sm"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Walker Preference */}
              <div className="mb-8">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-4 ml-1">Walker Preference</label>
                <select 
                  value={walkerPref}
                  onChange={(e) => setWalkerPref(e.target.value as any)}
                  className="artisan-input w-full text-sm appearance-none"
                >
                  <option value="no_preference">No Preference</option>
                  <option value="prefers_male">Prefers Male Walkers</option>
                  <option value="prefers_female">Prefers Female Walkers</option>
                </select>
              </div>

              {/* Immutable Location Badge */}
              <div className="bg-[#F2F0E9]/50 rounded-2xl p-4 border border-[#EBE7DE] flex items-center gap-3">
                <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-[#4A5D4E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-[#A09B8E]">Pickup Address (Verified)</p>
                  <p className="text-xs text-[#2D2D2D] font-medium truncate">{profile?.address}</p>
                </div>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="pt-4">
              <div className="text-center mb-4">
                <p className="text-[10px] text-[#A09B8E] italic">
                  This post will automatically disappear at{' '}
                  <span className="font-bold text-[#6B6658] not-italic">
                    {format(getExpiryPreview(), 'p')}
                  </span>
                </p>
              </div>
              
              <button
                disabled={createRequestMutation.isPending || (timeframe === 'scheduled' && !scheduledTime)}
                onClick={() => createRequestMutation.mutate()}
                className="btn-primary w-full py-4 text-sm tracking-widest"
              >
                {createRequestMutation.isPending ? 'BROADCASTING...' : 'POST TO NEIGHBORHOOD'}
              </button>
              
              <button 
                onClick={() => navigate({ to: '/dashboard' })}
                className="w-full py-4 text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] hover:text-[#6B6658] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-[#BC6C4D]/5 border border-[#BC6C4D]/10">
            <p className="text-xs text-[#BC6C4D] text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}