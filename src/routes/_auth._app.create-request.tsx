import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, addMinutes } from 'date-fns'
import { Plus, Lock } from 'lucide-react'

export const Route = createFileRoute('/_auth/_app/create-request')({
  component: CreateRequestComponent,
})

function CreateRequestComponent() {
  const { profile } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30)
  const [timeframe, setTimeframe] = useState<'now' | 'scheduled'>('now')
  const [scheduledTime, setScheduledTime] = useState<string>('')
  const [walkerPref, setWalkerPref] = useState<'no_preference' | 'prefers_male' | 'prefers_female'>('no_preference')
  const [error, setError] = useState<string | null>(null)

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

  const getExpiryPreview = () => {
    if (timeframe === 'now') return addMinutes(new Date(), 60)
    if (scheduledTime) return addMinutes(new Date(scheduledTime), -10)
    return addMinutes(new Date(), 60)
  }

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

  if (isLoading) return <div className="p-8 text-center font-serif italic text-brand-text">Gathering neighborhood data...</div>

  return (
    <div className="artisan-page-focus pt-8">
      <div className="artisan-container-large">
        {/* Dog Selection Section */}
        <section className="mb-8 text-left">
          <h2 className="text-label mb-4 ml-1">Who needs a walk?</h2>
          {helpDetails && helpDetails.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {helpDetails.map((dog) => (
                <button
                  key={dog.id}
                  onClick={() => setSelectedDogId(dog.id)}
                  className={`flex-shrink-0 w-32 artisan-card p-3 transition-all border-2 ${
                    selectedDogId === dog.id 
                      ? 'border-brand-green bg-white' 
                      : 'border-transparent bg-white/50'
                  }`}
                >
                  <div className="icon-box h-16 w-16 mx-auto mb-3">
                    {dog.photo_url ? (
                      <img src={dog.photo_url} alt={dog.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">🐕</span>
                    )}
                  </div>
                  <p className="artisan-card-title text-center">{dog.name}</p>
                  <p className="artisan-meta-tiny text-center">{dog.dog_size}</p>
                </button>
              ))}
              <button
                onClick={() => navigate({ to: '/help-details/create' })}
                className="flex-shrink-0 w-32 artisan-card p-3 border-2 border-dashed border-brand-border bg-transparent flex flex-col items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-all"
              >
                <div className="icon-box h-10 w-10 border-dashed bg-transparent">
                  <Plus className="w-5 h-5 text-brand-muted" />
                </div>
                <p className="text-label">Add New</p>
              </button>
            </div>
          ) : (
            <div className="alert-success border-2 border-dashed p-8">
              <p className="alert-body italic opacity-80 mb-4">No dog profiles found on your registry.</p>
              <button onClick={() => navigate({ to: '/help-details/create' })} className="text-label text-brand-green underline decoration-brand-green/30 underline-offset-4">
                + Create a Profile
              </button>
            </div>
          )}
        </section>

        {selectedDogId && (
          <div className="space-y-6 animate-in text-left">
            <div className="artisan-card p-6 bg-white">
              {/* Duration Segmented Control */}
              <div className="mb-8">
                <label className="text-label block mb-4 ml-1">Duration</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setDuration(m as any)}
                      className={`flex-1 py-3 rounded-xl transition-all border-2 ${
                        duration === m 
                          ? 'border-brand-green bg-brand-green text-white' 
                          : 'border-brand-stone text-brand-text hover:border-brand-border'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing Segmented Control */}
              <div className="mb-8">
                <label className="text-label block mb-4 ml-1">Timing</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button 
                    onClick={() => setTimeframe('now')} 
                    className={`py-3 rounded-xl border-2 transition-all ${
                      timeframe === 'now' ? 'border-brand-green bg-brand-green text-white' : 'border-brand-stone text-brand-text'
                    }`}
                  >
                    As Soon As Possible
                  </button>
                  <button 
                    onClick={() => setTimeframe('scheduled')} 
                    className={`py-3 rounded-xl border-2 transition-all ${
                      timeframe === 'scheduled' ? 'border-brand-green bg-brand-green text-white' : 'border-brand-stone text-brand-text'
                    }`}
                  >
                    Schedule Later
                  </button>
                </div>
                {timeframe === 'scheduled' && (
                  <input 
                    type="datetime-local" 
                    className="artisan-input text-sm mt-2" 
                    value={scheduledTime} 
                    onChange={(e) => setScheduledTime(e.target.value)} 
                  />
                )}
              </div>

              {/* Selection Input */}
              <div className="mb-8">
                <label className="text-label block mb-4 ml-1">Walker Preference</label>
                <div className="relative">
                  <select 
                    value={walkerPref} 
                    onChange={(e) => setWalkerPref(e.target.value as any)} 
                    className="artisan-input text-sm appearance-none bg-white"
                  >
                    <option value="no_preference">No Preference</option>
                    <option value="prefers_male">Prefers Male Walkers</option>
                    <option value="prefers_female">Prefers Female Walkers</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <Plus className="w-4 h-4 rotate-45" />
                  </div>
                </div>
              </div>

              {/* Verified Address Row */}
              <div className="artisan-card-inner py-4 px-5 flex items-center gap-3">
                <div className="icon-box h-8 w-8 bg-white border-brand-border/60">
                  <Lock className="w-4 h-4 text-brand-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-label text-sm mb-0.5">Pickup Address (Verified)</p>
                  <p className="text-xs text-brand-dark truncate">{profile?.address}</p>
                </div>
              </div>
            </div>

            {/* Submission Logic */}
            <div className="pt-4 text-center">
              <div className="mb-6">
                <p className="alert-body italic font-normal tracking-wider opacity-80">
                  This post will automatically disappear at <span className="text-brand-text not-italic">{format(getExpiryPreview(), 'p')}</span>
                </p>
              </div>
              
              <button 
                disabled={createRequestMutation.isPending || (timeframe === 'scheduled' && !scheduledTime)} 
                onClick={() => createRequestMutation.mutate()} 
                className="btn-primary"
              >
                {createRequestMutation.isPending ? 'Broadcasting...' : 'Post to neighborhood'}
              </button>
              
              <button 
                onClick={() => navigate({ to: '/dashboard' })} 
                className="nav-link-back w-full justify-center mt-6"
              >
                Cancel Request
              </button>
            </div>
          </div>
        )}

        {/* Error Messaging */}
        {error && (
          <div className="alert-error">
            <span className="alert-title">Request Error</span>
            <span className="alert-body">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}