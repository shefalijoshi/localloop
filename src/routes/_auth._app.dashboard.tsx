import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Dog, Clock, MapPin, ChevronRight, PlusCircle, ShieldCheck, Hand } from 'lucide-react'
import { format, isAfter } from 'date-fns'

export const Route = createFileRoute('/_auth/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { profile } = Route.useRouteContext()
  const queryClient = useQueryClient()
  
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const { data: feed, isLoading } = useQuery({
    queryKey: ['neighborhood_feed', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_neighborhood_feed')
      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-feed-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assists' },
        () => queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const myRequests = feed?.my_requests?.filter((r: any) => 
    isAfter(new Date(r.expires_at), now)
  ) || []

  const neighborRequests = feed?.neighborhood_requests?.filter((r: any) => 
    isAfter(new Date(r.expires_at), now)
  ) || []

  const activeAssists = feed?.active_assists || []

  return (
    <div className="pb-2 artisan-page-focus">
      {/* Action Pills */}
      <div className="artisan-container-large flex justify-end gap-3 mb-10">
        <Link
          to="/create-request"
          className="pill-primary"
          aria-label="Request a walk"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="text-label text-white">Request</span>
        </Link>
        
        <Link
          to="/vouch"
          className="pill-secondary"
          aria-label="Vouch for a neighbor"
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-label text-brand-green">Vouch</span>
        </Link>
      </div>

      {/* Section: Active assists */}
      {activeAssists.length > 0 && (
        <section className="mb-12 artisan-container-large">
          <h2 className="text-label mb-6">Confirmed Assist Details</h2>
          <div className="space-y-4">
          {activeAssists.map((assist: any) => {
            const isHelper = assist.helper_id === profile?.id;
            return (
              <Link 
                key={assist.id} 
                to="/assists/$assistId" 
                params={{ assistId: assist.id }}
                className="block artisan-card p-6 border-l-4 border-brand-terracotta hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`badge-pill ${
                        assist.status === 'in_progress' ? 'bg-orange-100 text-orange-700' : ''
                      }`}>
                        {assist.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-lg">
                      {isHelper ? `Walk for ${assist.seeker_name}` : `Walk by ${assist.helper_name}`}
                    </h3>
                    <div className="flex items-center gap-1 text-label font-medium">
                      <Dog className="w-3 h-3 opacity-80" />
                      <span>{assist.dog_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-label block">Code</span>
                      <span className="text-passcode text-lg ml-0">{assist.verification_code}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-brand-border group-hover:text-brand-terracotta transition-colors" />
                  </div>
                </div>
              </Link>
            )
          })}
          </div>
        </section>
      )}

      {/* Section: Your Requests */}
      {myRequests.length > 0 && (
        <section className="artisan-container-large mb-12">
          <h2 className="text-label mb-6">Your Active Requests</h2>
          <div className="space-y-4">
            {myRequests.map((req: any) => (
              <Link 
                key={req.id} 
                to="/requests/$requestId" 
                params={{ requestId: req.id }}
                className="block artisan-card p-4 border-l-4 border-brand-green hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="icon-box text-xl overflow-hidden">
                      {req.dog_photo ? (
                        <img src={req.dog_photo} alt="" className="h-full w-full object-cover" />
                      ) : '🐕'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4>{req.dog_name || 'Dog Walk'}</h4>
                        {req.offer_count > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-brand-terracotta text-white rounded-full">
                            <Hand className="w-2.5 h-2.5" />
                            <span className="text-[9px]">{req.offer_count}</span>
                          </div>
                        )}
                      </div>
                      <p className=".artisan-meta-tiny">
                        Expires {format(new Date(req.expires_at), 'p')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand-border" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      
      {/* Section: Neighborhood Activity */}
      <section className='artisan-container-large'>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-label">Neighborhood Requests</h2>
        </div>
        
        {isLoading ? (
          <div className="py-12 text-center text-brand-text italic text-xs font-serif">Gathering updates...</div>
        ) : neighborRequests.length > 0 ? (
          <div className="space-y-4">
            {neighborRequests.map((req: any) => (
              <Link 
                key={req.id} 
                to="/requests/$requestId" 
                params={{ requestId: req.id }}
                className="block artisan-card p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-pill bg-brand-green/10 text-brand-green">Dog Walk</span>
                        <span className="text-brand-text">• {req.duration}m</span>
                      </div>
                      <h3 className="text-xl">
                        {req.dog_name || 'Walk Needed'}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end text-label">
                        <Clock className="w-3 h-3" />
                        <span>Respond by {format(new Date(req.expires_at), 'p')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="detail-row pt-4 border-t border-brand-stone">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 opacity-80 text-brand-text" />
                      <span className="text-label tracking-wider">{req.street_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Dog className="w-3 h-3 opacity-80 text-brand-text" />
                      <span className="text-label lowercase font-medium">{req.dog_size} Dog</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="alert-success border-2 border-dashed py-16">
              <p className="alert-body italic opacity-80 px-8">
                "When neighbors need a hand with their dogs, their requests will appear here."
              </p>
          </div>
        )}
      </section>
    </div>
  )
}