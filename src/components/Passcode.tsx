// src/components/Passcode.tsx

interface PasscodeProps {
    code?: string;
    isExpired?: boolean;
    className?: string; // Allow parent to tweak spacing/margins
  }
  
  export function Passcode({ code, isExpired = false, className = "" }: PasscodeProps) {
    const isGhost = isExpired || !code;
  
    return (
      <div className={`flex justify-center gap-3 ${isGhost ? 'opacity-20 grayscale' : ''} ${className}`}>
        {!isGhost ? (
          code.split('').map((char, i) => (
            <span 
              key={i} 
              className="text-4xl font-mono font-bold text-[#2D2D2D] w-10 h-14 bg-white rounded-lg flex items-center justify-center shadow-sm border border-[#EBE7DE]"
            >
              {char}
            </span>
          ))
        ) : (
          Array.from({ length: 6 }).map((_, i) => (
            <span 
              key={i} 
              className="text-4xl font-mono font-bold text-[#A09B8E]/30 w-10 h-14 bg-white/50 rounded-lg flex items-center justify-center border border-dashed border-[#EBE7DE]"
            >
              •
            </span>
          ))
        )}
      </div>
    );
  }