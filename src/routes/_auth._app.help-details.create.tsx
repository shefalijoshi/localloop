import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Dog, Info, Plus, X } from 'lucide-react'

export const Route = createFileRoute('/_auth/_app/help-details/create')({
  component: CreateHelpDetailComponent,
})

function CreateHelpDetailComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [size, setSize] = useState<'small' | 'medium' | 'large' | 'giant'>('medium')
  const [specialNeeds, setSpecialNeeds] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [temperament, setTemperament] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !temperament.includes(tag)) {
      setTemperament([...temperament, tag])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTemperament(temperament.filter(t => t !== tagToRemove))
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User session not found")

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const { error } = await supabase
        .from('help_details')
        .insert({
          seeker_id: profile?.id,
          name,
          dog_size: size,
          temperament,
          special_needs: specialNeeds || null,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['help_details'] })
      navigate({ to: '/create-request' })
    },
    onError: (err: any) => setError(err.message)
  })

  return (
    <div className="artisan-page-focus pt-8">
      <div className="artisan-container-large">
        <header className="artisan-header">
          <div className="icon-box mx-auto mb-4 bg-brand-green/10 text-brand-green border-brand-green/20">
            <Dog className="w-6 h-6" />
          </div>
          <h1 className="artisan-header-title">Dog Profile</h1>
          <p className="artisan-header-description italic">Define the details for your dog's walk.</p>
        </header>

        <div className="artisan-card p-8 bg-white space-y-8 text-left">
          {/* Name Input */}
          <div>
            <label className="text-label block mb-3 ml-1">Dog's Name</label>
            <input 
              type="text"
              placeholder="e.g. Barnaby"
              className="artisan-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Size Selection */}
          <div>
            <label className="text-label block mb-4 ml-1">Size</label>
            <div className="grid grid-cols-2 gap-3">
              {['small', 'medium', 'large', 'giant'].map((s) => (
                <button
                key={s}
                onClick={() => setSize(s as any)}
                className={`artisan-toggle-btn ${
                  size === s ? 'artisan-toggle-btn-active' : 'artisan-toggle-btn-inactive'
                }`}
              >
                {s}
              </button>
              ))}
            </div>
          </div>

          {/* Temperament Tags */}
          <div>
            <label className="text-label block mb-3 ml-1">Temperament</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {temperament.map(tag => (
                <span key={tag} className="badge-pill border border-brand-border flex items-center gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-brand-terracotta transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input 
                type="text"
                placeholder="Add trait (e.g. friendly)..."
                className="artisan-input pr-10 text-sm"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
              />
              <button 
                onClick={addTag}
                className="artisan-tooltip-wrapper group absolute right-2 top-1/2 -translate-y-1/2"
              >
                <div className="icon-box h-8 w-8 bg-transparent border-none text-brand-green hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="artisan-tooltip">Add a tag</span>
              </button>
            </div>
          </div>

          {/* Special Needs */}
          <div>
            <div className="flex items-center gap-2 mb-3 ml-1">
              <label className="text-label">Special Needs</label>
              <div className="group relative">
                <Info className="w-3 h-3 text-brand-muted cursor-help" />
                <span className="artisan-tooltip">
                  Mention allergies, reactive triggers, or health conditions.
                </span>
              </div>
            </div>
            <textarea 
              placeholder="e.g. Reactive to squirrels, needs meds at 2pm..."
              className="artisan-input min-h-[100px] py-4 resize-none text-sm"
              value={specialNeeds}
              onChange={(e) => setSpecialNeeds(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="alert-error">
            <span className="alert-title">Profile Error</span>
            <span className="alert-body">{error}</span>
          </div>
        )}

        <div className="mt-10 space-y-4">
          <button
            disabled={createMutation.isPending || !name}
            onClick={() => createMutation.mutate()}
            className="btn-primary"
          >
            {createMutation.isPending ? 'Saving...' : 'Save dog profile'}
          </button>
          
          <button 
            onClick={() => navigate({ to: '/create-request' })}
            className="nav-link-back w-full justify-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}