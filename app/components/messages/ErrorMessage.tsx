'use client';

import { AlertCircle } from 'lucide-react';
import type { ErrorMessageData } from '../../lib/types';

export default function ErrorMessage({ message }: { message: ErrorMessageData }) {
  return (
    <div className="msg-container">
      <div className="msg-error" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '0.875rem'
      }}>
        <AlertCircle size={18} style={{ flexShrink: 0 }} />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
