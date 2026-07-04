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
          <ChatArea />
          <InputBar />
        </div>
      </div>
    </div>
  );
}
