import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/_auth/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { profile } = Route.useRouteContext()

  // Logic Preserved: Neighborhood data fetch
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

  return (
    <div className="min-h-screen bg-[#F9F7F2] pb-20">
      <div className="max-w-4xl mx-auto p-6">
        
        {/* Simplified Header */}
        <header className="mb-10 mt-8">
          <div className="flex items-center gap-2 text-[#4A5D4E] font-bold tracking-[0.2em] uppercase text-[9px] mb-2">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#4A5D4E]"></span>
            {neighborhood?.name || 'Local Neighborhood'}
          </div>
          <h1 className="text-3xl font-serif text-[#2D2D2D]">
            Welcome, {profile?.display_name?.split(' ')[0]}
          </h1>
        </header>

        {/* Compact Action Row */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Smaller Action: Invite */}
          <Link 
            to="/invite"
            className="artisan-card group p-5 bg-white border-t-2 border-[#EBE7DE] hover:border-[#4A5D4E] transition-all"
          >
            <div className="flex flex-col h-full">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] mb-2 group-hover:text-[#4A5D4E]">Registry</span>
              <h3 className="text-lg font-serif text-[#2D2D2D] mb-1">Invite</h3>
              <p className="text-[#6B6658] text-[11px] leading-snug opacity-70">
                Add neighbors within {neighborhood?.radius_miles || '0.5'} miles.
              </p>
            </div>
          </Link>

          {/* Smaller Action: Vouch */}
          <Link 
            to="/vouch"
            className="artisan-card group p-5 bg-white border-t-2 border-[#4A5D4E] hover:bg-[#4A5D4E]/5 transition-all"
          >
            <div className="flex flex-col h-full">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#4A5D4E] mb-2">Security</span>
              <h3 className="text-lg font-serif text-[#2D2D2D] mb-1">Vouch</h3>
              <p className="text-[#6B6658] text-[11px] leading-snug opacity-70">
                Verify a neighbor via handshake code.
              </p>
            </div>
          </Link>
        </div>
        
        {/* Feed Section */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-bold text-[#A09B8E] uppercase tracking-[0.2em]">Neighborhood Activity</h2>
            <div className="h-px flex-1 bg-[#EBE7DE] ml-4 opacity-40"></div>
          </div>
          
          <div className="bg-[#F2F0E9]/40 border-2 border-dashed border-[#EBE7DE] rounded-[1.5rem] py-16 text-center">
             <p className="text-[#A09B8E] text-[9px] font-bold uppercase tracking-[0.2em]">
               End of Registry
             </p>
             <p className="text-[#6B6658] text-[11px] mt-1 italic opacity-60">
               "Activity from your neighbors will appear here."
             </p>
          </div>
        </section>

      </div>
    </div>
  )
}