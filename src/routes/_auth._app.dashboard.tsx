import { useState, useEffect, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Check, Filter, PlusCircle, ShieldCheck, X } from 'lucide-react'
import { isAfter } from 'date-fns'
import { RequestCard } from '../components/RequestCard'
import { AssistCard } from '../components/AssistCard'
import { CATEGORY_INTENT } from '../lib/categoryIntent'

export const Route = createFileRoute('/_auth/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { profile } = Route.useRouteContext()
  const queryClient = useQueryClient()
  
  const [now, setNow] = useState(new Date())
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const { data: feed, isLoading } = useQuery({
    queryKey: ['neighborhood_feed', profile?.id, selectedCategories],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_neighborhood_feed', {
        filter_categories: selectedCategories.length > 0 ? selectedCategories : null
      })
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter expired items
  const myRequests = feed?.my_requests?.filter((r: any) => 
    isAfter(new Date(r.expires_at), now)
  ) || []

  const neighborRequests = feed?.neighborhood_requests?.filter((r: any) => 
    isAfter(new Date(r.expires_at), now)
  ) || []

  const activeAssists = feed?.active_assists || []

  const selectedCategoryData = selectedCategories.length === 1 && CATEGORY_INTENT.find(c => c.id === selectedCategories[0])

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleClearAll = () => {
    setSelectedCategories([])
  }

  return (
    <div className="pb-2 artisan-page-focus">
      {/* Action Pills */}
      <div className="artisan-container-large flex items-center justify-end gap-3 mb-10">
        <Link to="/create-request" className="pill-primary">
          <PlusCircle className="w-4 h-4" />
          <span className="text-label text-white">Request</span>
        </Link>
        
        <Link to="/vouch" className="pill-secondary">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-label text-brand-green">Vouch</span>
        </Link>

        <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-2 rounded-full text-xs font-medium transition-colors ${
                selectedCategories.length > 0
                  ? `${selectedCategoryData ? selectedCategoryData?.color : 'bg-brand-terracotta'} text-white`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {selectedCategories.length <= 0 && (
                <>
                  <Filter className="icon-box w-8 h-8 bg-brand-terracotta p-1 text-white" />
                  <span className='hidden sm:inline-flex text-label'>Filter</span>
                </>
              )}
              {selectedCategoryData && (
                <>
                  {(() => {
                    const Icon = selectedCategoryData.icon
                    return <Icon className="icon-box p-1 w-8 h-8" />
                  })()}
                  <span className='hidden sm:inline-flex'>{selectedCategoryData.label}</span>
                  <X 
                    className="p-1 w-6 h-6" 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearAll()
                    }}
                  />
                </>
              )}
              {selectedCategories.length > 1 && (
                <>
                <Filter className="icon-box text-white w-8 h-8" />
                <span className='text-label text-white'>{selectedCategories.length} <span className="hidden sm:inline-flex ">filters</span></span>
                <X 
                  className="w-6 h-6 p-1" 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearAll()
                  }}
                />
               </>
              )}
            </button>

            {/* Dropdown Menu */}
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">
                    {selectedCategories.length > 0 
                      ? `${selectedCategories.length} selected` 
                      : 'Select categories'}
                  </span>
                  {selectedCategories.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                
                {CATEGORY_INTENT.map((category) => {
                  const Icon = category.icon
                  const isSelected = selectedCategories.includes(category.id)
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryToggle(category.id)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                        isSelected ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected 
                          ? 'bg-brand-green border-brand-green' 
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <Icon className={`icon-box w-4 h-4 text-white ${category.color}`} />
                      {category.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
      </div>

      {/* 1. Section: Active Assists */}
      {activeAssists.length > 0 && (
        <section className="artisan-container-large mb-10">
          <h2 className="text-label mb-4">Help you've arranged</h2>
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
          <h2 className="text-label mb-4">What you need help with</h2>
          <div className="space-y-4">
            {myRequests.map((req: any) => (
              <RequestCard key={req.id} request={req} isMine={true} hasMyOffer={req.helper_id === profile?.id} />
            ))}
          </div>
        </section>
      )}
      
      {/* 3. Section: Neighborhood Activity */}
      <section className='artisan-container-large'>
        <h2 className="text-label mb-4">Neighbors looking for help</h2>        
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