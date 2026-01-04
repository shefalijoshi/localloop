// src/components/PasscodeInput.tsx
interface Props {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function PasscodeInput({ value, onChange, disabled }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* Invisible input to capture keystrokes */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        maxLength={6}
        className="absolute inset-0 opacity-0 cursor-text z-10"
        autoFocus
        disabled={disabled}
      />
      
      {/* Visual Slots mapped to the 6-character requirement */}
      <div className="flex justify-between gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const char = value[i];
          const isFocused = value.length === i && !disabled;
          
          return (
            <div
              key={i}
              className={`
                h-14 w-11 rounded-lg border flex items-center justify-center text-2xl font-mono font-bold transition-all duration-200
                ${char 
                  ? 'border-[#4A5D4E] bg-white text-[#2D2D2D] shadow-sm' // Active: Solid Green
                  : 'border-dashed border-[#EBE7DE] bg-[#F2F0E9]/50 text-[#A09B8E]/30' // Empty: Ghost Dots
                }
                ${isFocused ? 'ring-2 ring-[#4A5D4E]/20 border-[#4A5D4E] scale-105' : ''}
              `}
            >
              {char || '•'}
            </div>
          );
        })}
      </div>
    </div>
  );
}