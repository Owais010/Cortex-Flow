'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useChatContext } from '../../lib/context';

const EXAMPLES = [
  'Build a market research report for an AI startup',
  'Write a Python REST API with authentication',
  'Explain quantum computing in simple terms',
];

export default function SystemWelcome() {
  const { availableModels, sendPrompt } = useChatContext();
  const hasModels = availableModels.length > 0;

  return (
    <div className="msg-container">
      <div className="msg-system">
        <h2>What would you like to build?</h2>
        <p>Your prompt will be analyzed, decomposed, and routed to the best AI models.</p>

        <div className="msg-system-examples">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              className="msg-system-example"
              onClick={() => hasModels && sendPrompt(ex)}
              style={!hasModels ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              {ex}
            </button>
          ))}
        </div>

        {!hasModels && (
          <div className="msg-system-banner">
            <AlertTriangle size={14} />
            Connect at least 1 API key to start —{' '}
            <Link href="/settings">Settings</Link>
          </div>
        )}
      </div>
    </div>
  );
}
