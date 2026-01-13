import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { PlusCircle, ShieldCheck } from 'lucide-react'
import { isAfter } from 'date-fns'
import { RequestCard } from '../components/RequestCard'
import { AssistCard } from '../components/AssistCard'

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
    }, 60000)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assists' }, () => 
        queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Filter expired items
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
        <Link to="/create-request" className="pill-primary">
          <PlusCircle className="w-4 h-4" />
          <span className="text-label text-white">Request</span>
        </Link>
        
        <Link to="/vouch" className="pill-secondary">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-label text-brand-green">Vouch</span>
        </Link>
      </div>

      {/* 1. Section: Active Assists */}
      {activeAssists.length > 0 && (
        <section className="artisan-container-large mb-10">
          <h2 className="text-label mb-4">Confirmed Assists</h2>
          <div className="space-y-4">
            {activeAssists.map((assist: any) => (
              <AssistCard 
                key={assist.id} 
                assist={assist} 
                currentProfileId={profile?.id} 
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Section: Your Requests */}
      {myRequests.length > 0 && (
        <section className="artisan-container-large mb-10">
          <h2 className="text-label mb-4">Your Active Requests</h2>
          <div className="space-y-4">
            {myRequests.map((req: any) => (
              <RequestCard key={req.id} request={req} isMine={true} hasMyOffer={req.helper_id === profile?.id} />
            ))}
          </div>
        </section>
      )}
      
      {/* 3. Section: Neighborhood Activity */}
      <section className='artisan-container-large'>
        <h2 className="text-label mb-4">Neighborhood Requests</h2>
        
        {isLoading ? (
          <div className="py-12 text-center text-brand-text italic text-xs font-serif">
            Gathering updates...
          </div>
        ) : neighborRequests.length > 0 ? (
          <div className="space-y-4">
            {neighborRequests.map((req: any) => (
              <RequestCard key={req.id} request={req} isMine={false} hasMyOffer={req.helper_id === profile?.id} />
            ))}
          </div>
        ) : (
          <div className="alert-success border-2 border-dashed py-8">
            <p className="alert-body italic opacity-80 px-8 text-center">
              "When neighbors need a hand, their requests will appear here."
            </p>
          </div>
        )}
      </section>
    </div>
  )
}