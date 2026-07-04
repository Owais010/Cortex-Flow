'use client';

import Link from 'next/link';
import { AlertTriangle, Sparkles, Zap, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatContext } from '../../lib/context';

const EXAMPLES = [
  { text: 'Build a market research report for an AI startup', icon: Brain },
  { text: 'Write a Python REST API with authentication', icon: Zap },
  { text: 'Explain quantum computing in simple terms', icon: Sparkles },
];

export default function SystemWelcome() {
  const { availableModels, sendPrompt } = useChatContext();
  const hasModels = availableModels.length > 0;

  return (
    <div className="msg-container" style={{ margin: '0 auto', maxWidth: 860 }}>
      <div className="welcome-screen">
        {/* Animated logo icon */}
        <motion.div
          className="welcome-icon"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Sparkles size={28} />
        </motion.div>

        <motion.h2
          className="welcome-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          What would you like to build?
        </motion.h2>
        <motion.p
          className="welcome-subtitle"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Your prompt will be analyzed, decomposed, and routed to the best AI models.
        </motion.p>

        <motion.div
          className="welcome-examples"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {EXAMPLES.map((ex, i) => (
            <motion.button
              key={i}
              className="welcome-example-card"
              onClick={() => hasModels && sendPrompt(ex.text)}
              style={!hasModels ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              whileHover={hasModels ? { scale: 1.03, y: -4 } : {}}
              whileTap={hasModels ? { scale: 0.97 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div className="welcome-example-icon">
                <ex.icon size={18} />
              </div>
              <span>{ex.text}</span>
            </motion.button>
          ))}
        </motion.div>

        {!hasModels && (
          <motion.div
            className="welcome-banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <AlertTriangle size={14} />
            Connect at least 1 API key to start —{' '}
            <Link href="/settings">Settings</Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
