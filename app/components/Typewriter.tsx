'use client';

import { useEffect, useState } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export default function Typewriter({ text, speed = 50, className, onComplete }: TypewriterProps) {
  const [displayed, setDisplayed] = useState('');
  const [index, setIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayed(prev => prev + text[index]);
        setIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      onComplete?.();
    }
  }, [index, text, speed, onComplete]);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className}>
      {displayed}
      <span
        style={{
          display: 'inline-block',
          width: '2px',
          height: '1em',
          background: '#ffffff',
          marginLeft: '2px',
          verticalAlign: 'text-bottom',
          opacity: showCursor ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      />
    </span>
  );
}
