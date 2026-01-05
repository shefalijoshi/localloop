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
    <div className="min-h-screen bg-[#F9F7F2] pb-20 pt-8 px-6">
      <div className="max-w-md mx-auto">
        <header className="mb-10 text-center">
          {/* Use the Dog Icon here for visual identity */}
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#4A5D4E]/10 text-[#4A5D4E] mb-4">
            <Dog className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-serif text-[#2D2D2D] mb-2">Dog Profile</h1>
          <p className="text-[#6B6658] text-sm italic">Define the details for your dog's walk.</p>
        </header>

        <div className="artisan-card p-8 bg-white shadow-sm space-y-8">
          {/* Name Input */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-3 ml-1">Dog's Name</label>
            <input 
              type="text"
              placeholder="e.g. Barnaby"
              className="artisan-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Size Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-4 ml-1">Size</label>
            <div className="grid grid-cols-2 gap-3">
              {['small', 'medium', 'large', 'giant'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s as any)}
                  className={`py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all border-2 ${
                    size === s 
                      ? 'border-[#4A5D4E] bg-[#4A5D4E] text-white' 
                      : 'border-[#F2F0E9] text-[#A09B8E] hover:border-[#EBE7DE]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Temperament Tags */}
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] block mb-3 ml-1">Temperament</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {temperament.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-[#F2F0E9] text-[#6B6658] text-[10px] font-bold uppercase rounded-full border border-[#EBE7DE]">
                  {tag}
                  <button onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input 
                type="text"
                placeholder="Add trait (e.g. friendly, shy)..."
                className="artisan-input w-full pr-10 text-sm"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
              />
              <button 
                onClick={addTag}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5D4E]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Special Needs */}
          <div>
            <div className="flex items-center gap-2 mb-3 ml-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E]">
                Special Needs
              </label>
              {/* Use the Info Icon here as a subtle helper */}
              <div className="group relative">
                <Info className="w-3 h-3 text-[#A09B8E] cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#2D2D2D] text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Mention allergies, reactive triggers, or health conditions.
                </span>
              </div>
            </div>
            <textarea 
              placeholder="e.g. Reactive to squirrels, needs meds at 2pm..."
              className="artisan-input w-full min-h-[100px] py-3 resize-none text-sm"
              value={specialNeeds}
              onChange={(e) => setSpecialNeeds(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="mt-4 text-center text-xs text-red-500">{error}</p>}

        <div className="mt-10 space-y-4">
          <button
            disabled={createMutation.isPending || !name}
            onClick={() => createMutation.mutate()}
            className="btn-primary w-full py-4 text-sm tracking-widest"
          >
            {createMutation.isPending ? 'SAVING...' : 'SAVE DOG PROFILE'}
          </button>
          
          <button 
            onClick={() => navigate({ to: '/create-request' })}
            className="w-full text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] hover:text-[#6B6658]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}