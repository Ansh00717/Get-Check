import React from 'react';

interface ScoreGaugeProps {
  score: number;
  isDark?: boolean;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, isDark = true }) => {
  // Determine color based on score
  const getScoreDetails = (s: number) => {
    if (s <= 0) return { color: '#4B5563', shadowColor: 'rgba(75, 85, 99, 0.4)', label: 'Not Capable' };
    if (s <= 3.5) return { color: '#EF4444', shadowColor: 'rgba(239, 68, 68, 0.4)', label: 'Worst' };
    if (s <= 5.5) return { color: '#F97316', shadowColor: 'rgba(249, 115, 22, 0.4)', label: 'Bad' };
    if (s <= 7.5) return { color: '#EAB308', shadowColor: 'rgba(234, 179, 8, 0.4)', label: 'Average' };
    if (s < 9.8) return { color: '#22C55E', shadowColor: 'rgba(34, 197, 94, 0.4)', label: 'Good' };
    return { color: '#FFD700', shadowColor: 'rgba(255, 215, 0, 0.5)', label: 'Best' }; // Gold
  };

  const details = getScoreDetails(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 10);
  const strokeDashoffset = circumference - (progress / 10) * circumference;
  const isPerfect = score >= 9.8;

  // Track color adapts to theme for PDF readability
  const trackColor = isDark ? '#334155' : '#e2e8f0';

  return (
    <div className="relative w-full h-full flex items-center justify-center score-gauge">
      {/* Single SVG with gauge + text — avoids html2canvas offset bugs */}
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth="8"
          className="gauge-track"
        />
        {/* Progress arc — rotated -90° so it starts from top */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={details.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ 
            transition: 'stroke-dashoffset 1s ease-in-out',
            filter: `drop-shadow(0 0 6px ${details.shadowColor})`,
            transformOrigin: '50px 50px',
            transform: 'rotate(-90deg)',
          }}
        />
        {/* Score number */}
        <text
          x="46"
          y="52"
          textAnchor="middle"
          dominantBaseline="central"
          fill={details.color}
          fontWeight="900"
          fontSize="26"
          fontFamily="inherit"
          style={{ textShadow: `0 0 10px ${details.shadowColor}` }}
        >
          {score}
        </text>
        {/* /10 label — separate for better positioning and visibility */}
        <text
          x="72"
          y="55"
          textAnchor="middle"
          dominantBaseline="central"
          fill={details.color}
          fontWeight="700"
          fontSize="11"
          fontFamily="inherit"
          opacity="0.85"
        >
          /10
        </text>
      </svg>

      {/* Sparkles for Gold Score */}
      {isPerfect && (
        <>
            <div className="sparkle-icon" style={{ top: '10%', right: '20%', fontSize: '1.5rem', animationDelay: '0s' }}>✨</div>
            <div className="sparkle-icon" style={{ bottom: '15%', left: '15%', fontSize: '1rem', animationDelay: '0.5s' }}>✨</div>
            <div className="sparkle-icon" style={{ top: '15%', left: '20%', fontSize: '0.8rem', animationDelay: '1s' }}>✨</div>
            <div className="sparkle-icon" style={{ bottom: '30%', right: '10%', fontSize: '1.2rem', animationDelay: '0.2s' }}>✨</div>
        </>
      )}
    </div>
  );
};
