import { ArrowDown } from 'lucide-react'
import { useState } from 'react'

interface FeatureProps {
    Icon: any, 
    title: string, 
    desc: string, 
    colorClass: string, 
    index: number|null, 
    bgClass?: string|undefined
}

export function FeatureCard({ Icon, title, desc, colorClass, index=null, bgClass=undefined }: FeatureProps) {
    const [featureToggleIndex, setFeatureToggleIndex] = useState<number | null>(null)
    
    const isOpen = featureToggleIndex === index;

    return (
      <div className={`card-feature rounded-bento-sm ${colorClass} glass-morphism`}>
        <div className="flex items-start gap-1" onClick={() => setFeatureToggleIndex(featureToggleIndex === index ? null : index)}>
          <Icon className="w-6 h-6 shrink-0 text-brand-dark opacity-80" strokeWidth={2} />
          <h3 className="font-bold text-brand-dark">{title}</h3>
          <ArrowDown className={`md:hidden w-5 h-5 mt-1 text-brand-dark ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        <div className={`${bgClass ? `w-full h-full md:min-h-60 ${bgClass}` : ''}`}>
          <p className={`text-sm text-brand-text mb-1 ${isOpen ? 'block':'hidden md:block'}`}>{desc}</p>
        </div>
      </div>
    )
  }