'use client';

import { type ReactNode, useRef, useState } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export default function GlowCard({ children, className = '', glowColor = 'rgba(255,255,255,0.04)' }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setGlow({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setGlow(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Mouse-follow radial glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          background: `radial-gradient(300px circle at ${glow.x}px ${glow.y}px, ${glowColor}, transparent 70%)`,
          opacity: glow.opacity,
          transition: 'opacity 0.3s ease',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
