'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatContext } from '../lib/context';
import UserMessage from './messages/UserMessage';
import SystemWelcome from './messages/SystemWelcome';
import PlanMessage from './messages/PlanMessage';
import ExecutingMessage from './messages/ExecutingMessage';
import ResultMessage from './messages/ResultMessage';
import ErrorMessage from './messages/ErrorMessage';
import type { Message, UserMessageData, PlanMessageData, ExecutingMessageData, ResultMessageData, ErrorMessageData } from '../lib/types';

function RenderMessage({ message }: { message: Message }) {
  switch (message.type) {
    case 'system':
      return <SystemWelcome />;
    case 'user':
      return <UserMessage message={message as UserMessageData} />;
    case 'plan':
      return <PlanMessage message={message as PlanMessageData} />;
    case 'executing':
      return <ExecutingMessage message={message as ExecutingMessageData} />;
    case 'result':
      return <ResultMessage message={message as ResultMessageData} />;
    case 'error':
      return <ErrorMessage message={message as ErrorMessageData} />;
    default:
      return null;
  }
}

function LoadingIndicator() {
  return (
    <motion.div
      className="msg-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <div className="loading-dots">
          <span /><span /><span />
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing prompt...</span>
      </div>
    </motion.div>
  );
}

export default function ChatArea() {
  const { chats, activeChatId, isLoading } = useChatContext();
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, isLoading]);

  if (!activeChat) return <div className="chat-area" />;

  return (
    <div className="chat-messages">
      <AnimatePresence mode="popLayout">
        {activeChat.messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <RenderMessage message={msg} />
          </motion.div>
        ))}
      </AnimatePresence>
      {isLoading && <LoadingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
