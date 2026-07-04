'use client';

import { useRef, useState, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { useChatContext } from '../lib/context';

export default function InputBar() {
  const { sendPrompt, isLoading, isExecuting, availableModels } = useChatContext();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = isLoading || isExecuting || availableModels.length === 0;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    sendPrompt(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, sendPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const placeholder = availableModels.length === 0
    ? 'Connect an API key in Settings to start...'
    : 'Describe your task...';

  return (
    <div className="input-bar">
      <div className="input-bar-inner">
        <textarea
          ref={textareaRef}
          className="input-textarea"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          disabled={disabled}
        />
        <button
          className="input-send-btn"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          title="Send"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
