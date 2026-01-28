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
        <div className="flex items-center flex-col gap-1" onClick={() => setFeatureToggleIndex(featureToggleIndex === index ? null : index)}>
          <Icon className={`w-10 h-10 shrink-0 text-brand-dark ${bgClass} opacity-80`} />
          <h3 className="font-bold text-brand-dark">{title}</h3>
          </div>
        <div className="w-full h-full">
          <p className={`text-sm text-brand-text mb-1}`}>{desc}</p>
        </div>
      </div>
    )
  }