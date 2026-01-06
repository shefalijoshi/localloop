import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Dog, Clock, MapPin, ChevronRight, PlusCircle, ShieldCheck, UserPlus, Hand } from 'lucide-react'
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

  const { data: neighborhood } = useQuery({
    queryKey: ['neighborhood', profile?.neighborhood_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('name, radius_miles')
        .eq('id', profile?.neighborhood_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!profile?.neighborhood_id,
  })

  const { data: feed, isLoading } = useQuery({
    queryKey: ['neighborhood_feed', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_neighborhood_feed')
      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  // 4. Real-time Subscription: Refresh on database changes

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
          // Invalidate the feed query to trigger a refresh of the counts
          queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
        }
      )
      .on( // Merged assist listener
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assists' },
        () => queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // 5. Client-side Passive Expiry Filter
  // This ensures cards vanish the moment 'now' passes 'expires_at'
  const myRequests = feed?.my_requests?.filter((r: any) => 
    isAfter(new Date(r.expires_at), now)
  ) || []

  const neighborRequests = feed?.neighborhood_requests?.filter((r: any) => 
    isAfter(new Date(r.expires_at), now)
  ) || []

  const activeAssists = feed?.active_assists || []

  return (
    <div className="min-h-screen bg-[#F9F7F2] pb-20">
      <div className="max-w-4xl mx-auto p-6">
        
        {/* Header */}
        <header className="mb-10 mt-8">
          <div className="flex items-center gap-2 text-[#4A5D4E] font-bold tracking-[0.2em] uppercase text-[9px] mb-2">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#4A5D4E]"></span>
            {neighborhood?.name || 'Local Neighborhood'}
          </div>
          <h1 className="text-3xl font-serif text-[#2D2D2D]">
            Welcome, {profile?.display_name?.split(' ')[0]}
          </h1>
        </header>

        {/* Action Row */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <Link 
            to="/create-request"
            className="artisan-card group p-5 bg-white border-t-2 border-[#4A5D4E] hover:bg-[#4A5D4E]/5 transition-all"
          >
            <div className="flex flex-col h-full">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#4A5D4E] mb-2">Service</span>
              <h3 className="text-lg font-serif text-[#2D2D2D] mb-1 flex items-center gap-2">
                Request <PlusCircle className="w-4 h-4 opacity-50" />
              </h3>
              <p className="text-[#6B6658] text-[11px] leading-snug opacity-70">
                Ask neighbors for a walk.
              </p>
            </div>
          </Link>

          <Link 
            to="/vouch"
            className="artisan-card group p-5 bg-white border-t-2 border-[#EBE7DE] hover:border-[#4A5D4E] transition-all"
          >
            <div className="flex flex-col h-full">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] mb-2 group-hover:text-[#4A5D4E]">Security</span>
              <h3 className="text-lg font-serif text-[#2D2D2D] mb-1 flex items-center gap-2">
                Vouch <ShieldCheck className="w-4 h-4 opacity-50" />
              </h3>
              <p className="text-[#6B6658] text-[11px] leading-snug opacity-70">
                Verify a neighbor via code.
              </p>
            </div>
          </Link>
        </div>

        {/* Section: Active assists */}
        {activeAssists.length > 0 && (
          <section className="mb-12">
            <h2 className="text-[10px] font-bold text-[#A09B8E] uppercase tracking-[0.2em] mb-6">Confirmed Assist Details</h2>
            <div className="space-y-4">
              {activeAssists.map((assist: any) => {
                const isHelper = assist.helper_id === profile?.id;
                return (
                  <div key={assist.id} className="artisan-card p-6 bg-white border-t-4 border-[#BC6C4D]">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className={`px-2 py-0.5 ${assist.status === 'in_progress' ? 'bg-orange-100 text-orange-700' : 'bg-[#BC6C4D]/10 text-[#BC6C4D]'} text-[9px] font-bold rounded uppercase tracking-tighter`}>
                          {assist.status.replace('_', ' ')}
                        </span>
                        <h3 className="text-xl font-serif text-[#2D2D2D] mt-1">
                          {isHelper ? `Helping ${assist.seeker_name}` : `${assist.helper_name} is helping you`}
                        </h3>
                        <p className="text-[#6B6658] text-[11px] mt-1">
                          Walk for <span className="font-bold">{assist.dog_name}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-[#A09B8E] uppercase block mb-1">Verify Code</span>
                        <span className="text-2xl font-serif tracking-widest text-[#2D2D2D]">{assist.verification_code}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#F2F0E9]">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] text-[#6B6658]">
                          <MapPin className="w-3.5 h-3.5 opacity-40" />
                          <span>{isHelper ? assist.seeker_address : 'Your Home'}</span>
                        </div>
                      </div>
                      {isHelper ? (
                      <div className="space-y-1">
                          <span className="text-[9px] font-bold text-[#A09B8E] uppercase block">Contact Neighbor</span>
                          <div className="text-[11px] text-[#2D2D2D]">
                            <div>{assist.seeker_email}</div>
                          </div>
                      </div>) : (
                      <div className="space-y-1">
                          <span className="text-[9px] font-bold text-[#A09B8E] uppercase block">Contact Neighbor</span>
                          <div className="text-[11px] text-[#2D2D2D]">
                            {assist.helper_shared_phone && <div>{assist.helper_phone}</div>}
                            {assist.helper_shared_email && <div>{assist.helper_email}</div>}
                            {!assist.helper_shared_phone && !assist.helper_shared_email && <span className="italic opacity-50">No contact shared</span>}
                          </div>
                      </div>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
        {/* Section: Your Requests */}
        {myRequests.length > 0 && (
          <section className="mb-12">
            <h2 className="text-[10px] font-bold text-[#A09B8E] uppercase tracking-[0.2em] mb-6">Your Active Requests</h2>
            <div className="space-y-4">
              {myRequests.map((req: any) => (
                <Link 
                  key={req.id} 
                  to="/requests/$requestId" 
                  params={{ requestId: req.id }}
                  className="block artisan-card p-4 bg-white border-l-4 border-[#4A5D4E] shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-[#F2F0E9] rounded-full flex items-center justify-center text-xl overflow-hidden border border-[#EBE7DE]">
                        {req.dog_photo ? (
                          <img src={req.dog_photo} alt="" className="h-full w-full object-cover" />
                        ) : '🐕'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif text-[#2D2D2D]">{req.dog_name || 'Dog Walk'}</h4>
                          {req.offer_count > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#BC6C4D] text-white rounded-full">
                              <Hand className="w-2.5 h-2.5" />
                              <span className="text-[9px] font-bold">{req.offer_count}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-[#A09B8E] uppercase tracking-wide">
                          Expires {format(new Date(req.expires_at), 'p')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#EBE7DE]" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        
        {/* Section: Neighborhood Activity */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-bold text-[#A09B8E] uppercase tracking-[0.2em]">Neighborhood Requests</h2>
            <div className="h-px flex-1 bg-[#EBE7DE] ml-4 opacity-40"></div>
          </div>
          
          {isLoading ? (
            <div className="py-12 text-center text-[#6B6658] italic text-xs font-serif">Gathering updates...</div>
          ) : neighborRequests.length > 0 ? (
            <div className="space-y-4">
              {neighborRequests.map((req: any) => (
                <Link 
                  key={req.id} 
                  to="/requests/$requestId" 
                  params={{ requestId: req.id }}
                  className="block artisan-card p-6 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-[#4A5D4E]/10 text-[#4A5D4E] text-[9px] font-bold rounded uppercase tracking-tighter">Dog Walk</span>
                          <span className="text-[#A09B8E] text-[10px]">• {req.duration}m</span>
                        </div>
                        <h3 className="text-xl font-serif text-[#2D2D2D]">
                          {req.dog_name || 'Walk Needed'}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end text-[10px] font-bold text-[#A09B8E] uppercase tracking-tighter">
                          <Clock className="w-3 h-3" />
                          <span>Respond by {format(new Date(req.expires_at), 'p')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-[#6B6658] text-[11px] pt-4 border-t border-[#F2F0E9]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 opacity-40" />
                        <span className="font-medium uppercase tracking-wider">{req.street_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Dog className="w-3 h-3 opacity-40" />
                        <span className="capitalize">{req.dog_size} Dog</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-[#F2F0E9]/40 border-2 border-dashed border-[#EBE7DE] rounded-[2rem] py-16 text-center">
               <p className="text-[#A09B8E] text-[9px] font-bold uppercase tracking-[0.2em] mb-1">
                 All quiet on the street
               </p>
               <p className="text-[#6B6658] text-[11px] italic opacity-60 px-8">
                 "When neighbors need a hand with their dogs, their requests will appear here."
               </p>
            </div>
          )}
        </section>

        <footer className="mt-16 pt-8 border-t border-[#EBE7DE] text-center">
          <Link to="/invite" className="inline-flex items-center gap-2 text-[#A09B8E] hover:text-[#4A5D4E] transition-colors">
            <UserPlus className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Invite to Registry</span>
          </Link>
        </footer>

      </div>
    </div>
  )
}