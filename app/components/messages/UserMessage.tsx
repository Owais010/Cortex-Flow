'use client';

import { formatTimestamp } from '../../lib/utils';
import type { UserMessageData } from '../../lib/types';

export default function UserMessage({ message }: { message: UserMessageData }) {
  return (
    <div className="msg-container">
      <div className="msg-user">
        <div className="msg-user-bubble">
          {message.content}
          <div className="msg-user-time">{formatTimestamp(message.timestamp)}</div>
        </div>
      </div>
    </div>
  );
}
