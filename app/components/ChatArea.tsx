'use client';

import { useRef, useEffect } from 'react';
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
    <div className="msg-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <div className="loading-dots">
          <span /><span /><span />
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing prompt...</span>
      </div>
    </div>
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
      {activeChat.messages.map((msg) => (
        <RenderMessage key={msg.id} message={msg} />
      ))}
      {isLoading && <LoadingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
