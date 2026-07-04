'use client';

import { Plus, MessageSquare, X } from 'lucide-react';
import Link from 'next/link';
import { useChatContext } from '../lib/context';

export default function Sidebar() {
  const {
    chats,
    activeChatId,
    connectedProviders,
    addChat,
    setActiveChat,
    deleteChat,
  } = useChatContext();

  const connectedCount = connectedProviders.filter(p => p.status === 'active').length;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="sidebar-new-chat" onClick={() => addChat()}>
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <div className="sidebar-chats">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`sidebar-chat-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => setActiveChat(chat.id)}
          >
            <MessageSquare size={14} style={{ color: 'var(--text-dim)', marginRight: 8, flexShrink: 0 }} />
            <span className="sidebar-chat-title">{chat.title}</span>
            {chats.length > 1 && (
              <button
                className="sidebar-chat-delete"
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                title="Delete chat"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className={`status-dot ${connectedCount > 0 ? 'connected' : 'disconnected'}`} />
          {connectedCount}/3 providers connected
        </div>
        <Link href="/settings" className="sidebar-manage-link">
          Manage API Keys →
        </Link>
      </div>
    </div>
  );
}
