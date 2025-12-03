import React, { useEffect, useState } from 'react';

interface ThemeTransitionProps {
  targetTheme: 'dark' | 'light';
  onAnimationComplete: () => void;
  onThemeSwitch: () => void;
}

const Clouds = () => (
  <div className="absolute inset-0 pointer-events-none opacity-80">
      {/* Cloud 1 */}
      <div className="absolute top-[10%] left-[-20%] w-[30vh] h-[10vh] animate-[float_20s_linear_infinite] opacity-60">
        <svg viewBox="0 0 100 40" className="w-full h-full fill-white">
           <path d="M10,30 Q20,10 40,25 Q50,5 70,20 Q90,10 95,30 Z" />
        </svg>
      </div>
       {/* Cloud 2 */}
       <div className="absolute top-[25%] left-[-10%] w-[40vh] h-[12vh] animate-[float_25s_linear_infinite_2s] opacity-40">
        <svg viewBox="0 0 100 40" className="w-full h-full fill-white">
           <path d="M0,35 Q20,15 40,30 Q60,10 80,25 Q95,20 100,35 Z" />
        </svg>
      </div>
      {/* Cloud 3 */}
      <div className="absolute top-[15%] left-[-15%] w-[25vh] h-[8vh] animate-[float_30s_linear_infinite_5s] opacity-30">
        <svg viewBox="0 0 100 40" className="w-full h-full fill-white">
           <path d="M10,30 Q30,10 50,25 Q70,15 90,30 Z" />
        </svg>
      </div>
  </div>
);

const ShootingStars = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
            <div 
                key={i}
                className="absolute h-0.5 bg-gradient-to-r from-transparent via-white to-transparent w-[100px] animate-[shoot_3s_linear_infinite]"
                style={{
                    top: Math.random() * 40 + '%',
                    left: Math.random() * 50 + 50 + '%',
                    animationDelay: Math.random() * 5 + 's',
                    transform: 'rotate(-20deg)',
                    opacity: 0
                }}
            />
        ))}
    </div>
);

export const ThemeTransition: React.FC<ThemeTransitionProps> = ({ 
  targetTheme, 
  onAnimationComplete,
  onThemeSwitch 
}) => {
  const [phase, setPhase] = useState<'enter' | 'animate' | 'exit'>('enter');
  
  // Target is Dark = Sunset (Sun goes down)
  // Target is Light = Sunrise (Sun comes up)
  const isSunset = targetTheme === 'dark';

  useEffect(() => {
    // 1. Mount Phase (Fade In Overlay)
    const enterTimer = setTimeout(() => setPhase('animate'), 100);

    // 2. Switch Theme Logic (Mid-animation)
    const switchTimer = setTimeout(() => {
      onThemeSwitch();
    }, 2500); // Switch at 2.5s

    // 3. Exit Phase (Fade Out Overlay)
    const exitTimer = setTimeout(() => {
      setPhase('exit');
    }, 4500); // Start fading out

    // 4. Cleanup
    const completeTimer = setTimeout(() => {
      onAnimationComplete();
    }, 5500); // Fully unmount

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(switchTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-[100] overflow-hidden flex flex-col justify-end transition-opacity duration-1000 ease-in-out pointer-events-none font-sans
        ${phase === 'enter' ? 'opacity-0' : phase === 'exit' ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <style>{`
        @keyframes float {
          0% { transform: translateX(0); }
          100% { transform: translateX(120vw); }
        }
        @keyframes shoot {
            0% { transform: translateX(0) translateY(0) rotate(-20deg); opacity: 0; }
            10% { opacity: 1; }
            20% { transform: translateX(-200px) translateY(100px) rotate(-20deg); opacity: 0; }
            100% { opacity: 0; }
        }
        @keyframes gridMove {
            0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
            100% { transform: perspective(500px) rotateX(60deg) translateY(40px); }
        }
      `}</style>

      {/* --- SKY LAYER --- */}
      <div className="absolute inset-0 bg-[#0f172a]" /> {/* Base Night Color */}
      
      {/* Day/Sunset Gradient */}
      <div 
        className="absolute inset-0 transition-opacity duration-[3000ms] ease-in-out"
        style={{
          opacity: isSunset 
            ? (phase === 'animate' ? 0 : 1) // Day -> Night
            : (phase === 'animate' ? 1 : 0), // Night -> Day
          background: 'linear-gradient(to bottom, #3b82f6 0%, #8b5cf6 40%, #f43f5e 70%, #fbbf24 100%)' // Blue -> Purple -> Pink -> Yellow
        }}
      />
      
      {/* Night Gradient */}
      <div 
        className="absolute inset-0 transition-opacity duration-[3000ms] ease-in-out"
        style={{
          opacity: isSunset 
            ? (phase === 'animate' ? 1 : 0) // Day -> Night
            : (phase === 'animate' ? 0 : 1), // Night -> Day
          background: 'linear-gradient(to bottom, #020617 0%, #1e1b4b 50%, #4c1d95 100%)' // Black -> Deep Blue -> Purple
        }}
      />

      {/* --- STARS & CLOUDS --- */}
      <div className="absolute inset-0">
          {/* Stars (Only visible at night) */}
          <div 
            className="absolute inset-0 transition-opacity duration-[2000ms]"
            style={{ opacity: isSunset && phase === 'animate' ? 1 : (!isSunset && phase !== 'animate' ? 1 : 0) }}
          >
              {[...Array(50)].map((_, i) => (
                <div 
                    key={i} 
                    className="absolute bg-white rounded-full animate-pulse"
                    style={{
                        width: Math.random() * 2 + 1 + 'px',
                        height: Math.random() * 2 + 1 + 'px',
                        top: Math.random() * 60 + '%',
                        left: Math.random() * 100 + '%',
                        animationDelay: Math.random() * 3 + 's',
                        opacity: Math.random()
                    }}
                />
              ))}
              <ShootingStars />
          </div>

          {/* Clouds (Visible during transition) */}
          <Clouds />
      </div>

      {/* --- SUN --- */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[45vh] h-[45vh] rounded-full transition-all duration-[3000ms] ease-in-out z-10"
        style={{
          bottom: isSunset 
            ? (phase === 'animate' ? '-15vh' : '40vh')  // Sunset: High -> Low
            : (phase === 'animate' ? '40vh' : '-15vh'), // Sunrise: Low -> High
          background: 'linear-gradient(to bottom, #fef08a, #facc15, #f97316, #ec4899)',
          boxShadow: '0 0 80px rgba(251, 146, 60, 0.6)'
        }}
      />

      {/* --- MOUNTAINS --- */}
      <div 
        className="absolute bottom-[22vh] left-0 right-0 h-[25vh] z-20 transition-transform duration-[4000ms]"
         style={{ transform: `translateY(${phase === 'animate' ? '0' : '40px'})` }}
      >
         <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full text-[#1e1b4b] fill-current">
            <path d="M0,160L48,176C96,192,192,224,288,218.7C384,213,480,171,576,170.7C672,171,768,213,864,229.3C960,245,1056,235,1152,218.7C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
         </svg>
      </div>

      {/* --- OCEAN with RETRO GRID --- */}
      <div className="absolute bottom-0 left-0 right-0 h-[25vh] z-30 bg-[#2e1065] overflow-hidden perspective-[500px]">
         {/* Base Water Gradient */}
         <div className="absolute inset-0 bg-gradient-to-b from-[#4c1d95] via-[#2e1065] to-[#0f172a]" />
         
         {/* Moving Grid Lines (Vaporwave Style) */}
         <div 
            className="absolute inset-[-100%] w-[300%] h-[300%] opacity-40 animate-[gridMove_2s_linear_infinite]"
            style={{
                backgroundSize: '40px 40px',
                backgroundImage: `linear-gradient(to right, rgba(236, 72, 153, 0.5) 1px, transparent 1px),
                                  linear-gradient(to bottom, rgba(236, 72, 153, 0.5) 1px, transparent 1px)`,
                transformOrigin: '50% 100%',
            }}
         />

         {/* Sun Reflection */}
         <div 
            className="absolute left-1/2 -translate-x-1/2 w-[15vh] h-full transition-all duration-[3000ms] ease-in-out"
            style={{
                background: 'linear-gradient(to bottom, rgba(253, 224, 71, 0.8) 0%, rgba(244, 63, 94, 0.4) 60%, transparent 100%)',
                opacity: 0.8,
                filter: 'blur(15px)',
                mixBlendMode: 'overlay'
            }}
         />
      </div>

      {/* --- PALM TREES (Foreground Silhouette) --- */}
      <div className="absolute inset-0 z-40 pointer-events-none">
          {/* Left Palm */}
          <div className="absolute bottom-[18vh] -left-10 w-[45vh] h-[65vh] text-[#020617] opacity-100 drop-shadow-2xl">
             <svg viewBox="0 0 100 100" className="w-full h-full fill-current" preserveAspectRatio="none">
                 <path d="M45,100 Q40,60 10,40 Q30,50 40,60 Q20,20 40,30 Q45,50 48,60 Q55,10 65,30 Q60,50 55,65 Q90,40 70,70 Q60,75 55,80 Q55,90 50,100 Z" transform="rotate(10 50 100)"/>
             </svg>
          </div>

          {/* Right Palm */}
          <div className="absolute bottom-[15vh] -right-20 w-[55vh] h-[75vh] text-[#020617] opacity-100 drop-shadow-2xl">
              <svg viewBox="0 0 100 100" className="w-full h-full fill-current" style={{ transform: 'scaleX(-1)' }} preserveAspectRatio="none">
                 <path d="M45,100 Q40,60 10,40 Q30,50 40,60 Q20,20 40,30 Q45,50 48,60 Q55,10 65,30 Q60,50 55,65 Q90,40 70,70 Q60,75 55,80 Q55,90 50,100 Z" transform="rotate(15 50 100)"/>
             </svg>
          </div>
      </div>
      
      {/* --- VIGNETTE --- */}
      <div className="absolute inset-0 z-50 pointer-events-none mix-blend-multiply bg-[radial-gradient(circle,transparent_50%,black_150%)]" />

    </div>
  );
};