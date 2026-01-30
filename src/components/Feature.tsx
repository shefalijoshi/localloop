import { useState } from 'react'

interface FeatureProps {
    Icon: any, 
    title: string, 
    desc: string, 
    colorClass: string, 
    index: number | null, 
}

export function FeatureCard({ Icon, title, desc, colorClass, index = null }: FeatureProps) {
    const [isActive, setIsActive] = useState(false)
    
    return (
      <div 
        className={`card-feature ${colorClass} p-8 flex flex-col items-center text-center`}
        style={{ 
          animationDelay: index !== null ? `${(index + 2) * 150}ms` : '0ms',
        }}
      >
        <div 
          className="flex items-center flex-col gap-6 cursor-pointer group w-full" 
          onClick={() => setIsActive(!isActive)}
        >
          <div className="icon-box w-16 h-16 rounded-2xl bg-white/50 backdrop-blur-md shadow-lg border border-white/40 transition-all group-hover:scale-110">
            <Icon className="w-8 h-8 shrink-0 text-brand-dark opacity-90" />
          </div>
          
          <h3 className="font-black text-brand-dark tracking-tighter text-lg leading-tight">{title}</h3>
        </div>
        <div className="w-full mt-4">
          <p className="text-sm text-brand-text font-medium leading-relaxed opacity-80 px-2">
            {desc}
          </p>
        </div>
        <div className={`w-12 h-1 rounded-full mt-8 transition-all duration-300 ${isActive ? 'bg-brand-green w-20' : 'bg-brand-dark/10'}`} />
      </div>
    )
}