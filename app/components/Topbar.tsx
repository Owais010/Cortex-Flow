'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatContext } from '../lib/context';

export default function Topbar() {
  const { connectedProviders, availableModels, backendOnline, user, logout } = useChatContext();
  const router = useRouter();

  const providerStatus = (name: string) => {
    const p = connectedProviders.find(cp => cp.provider === name);
    if (p && p.status === 'active') return 'connected';
    return 'disconnected';
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <motion.div
      className="topbar"
      initial={{ y: -56 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="topbar-logo">CORTEX FLOW</div>
      <div className="topbar-right">
        {!backendOnline && (
          <span style={{ fontSize: 11, color: 'var(--error)' }}>Backend offline</span>
        )}
        <div className="topbar-models">
          <span className={`status-dot ${providerStatus('openai')}`} title="OpenAI" />
          <span className={`status-dot ${providerStatus('anthropic')}`} title="Anthropic" />
          <span className={`status-dot ${providerStatus('google_gemini')}`} title="Gemini" />
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {availableModels.length} model{availableModels.length !== 1 ? 's' : ''}
          </span>
        </div>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Link href="/settings" className="topbar-settings-link" title="Settings">
            <Settings size={18} />
          </Link>
        </motion.div>
        {user && (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {user.email?.split('@')[0]}
            </span>
            <motion.button
              onClick={handleLogout}
              className="topbar-settings-link"
              title="Logout"
              style={{ border: 'none' }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <LogOut size={16} />
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}
