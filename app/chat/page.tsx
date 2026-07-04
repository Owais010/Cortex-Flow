'use client';

import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import InputBar from '../components/InputBar';

export default function ChatPage() {
  return (
    <div className="app-layout">
      <Topbar />
      <div className="app-body">
        <Sidebar />
        <div className="chat-area">
          {/* Ambient glow orbs behind the chat */}
          <div className="chat-ambient-orb chat-ambient-orb-1" aria-hidden="true" />
          <div className="chat-ambient-orb chat-ambient-orb-2" aria-hidden="true" />
          <ChatArea />
          <InputBar />
        </div>
      </div>
    </div>
  );
}
