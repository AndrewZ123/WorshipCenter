'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Avatar from '@/components/ui/Avatar';
import { db } from '@/lib/store';
import type { User } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  chat_id: string;
  content: string;
  created_at: string;
  sender_user_id: string;
  read_at: string | null;
  sender: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

interface ServiceChatProps {
  serviceId: string;
  churchId: string;
  currentUser: User | null;
  isDemo?: boolean;
}

type RenderItem =
  | { type: 'date'; key: string; label: string }
  | {
      type: 'message';
      key: string;
      message: Message;
      isOwn: boolean;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUP_WINDOW_MS = 2 * 60 * 1000; // 2 min
const MAX_MESSAGE_LENGTH = 2000;
const SCROLL_THRESHOLD = 120; // px from bottom

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isNewDay(prevDate: string, currDate: string): boolean {
  return new Date(prevDate).toDateString() !== new Date(currDate).toDateString();
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ServiceChat({ serviceId, churchId, currentUser, isDemo = false }: ServiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const messageIdSetRef = useRef<Set<string>>(new Set());
  const hasMarkedReadRef = useRef(false);

  // ─── Textarea helpers ──────────────────────────────────────────────────────

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const resetTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = 'auto';
  }, []);

  // ─── Scroll management ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distFromBottom < SCROLL_THRESHOLD;
    setShowScrollButton(distFromBottom > 250);
  }, []);

  // ─── Load messages ──────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      hasMarkedReadRef.current = false;
      isInitialLoadRef.current = true;
      const msgs = await db.serviceChat.getMessages(serviceId, churchId);
      messageIdSetRef.current = new Set(msgs.map((m) => m.id));
      setMessages(msgs);
    } catch (err) {
      console.error('[ServiceChat] Failed to load messages:', err);
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [serviceId, churchId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ─── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    if (isDemo) return; // Demo mode: no realtime

    const unsubscribe = db.serviceChat.subscribe(
      serviceId,
      churchId,
      (message: Message) => {
        // Dedup by message ID (prevents duplicates from optimistic + realtime)
        if (messageIdSetRef.current.has(message.id)) return;
        messageIdSetRef.current.add(message.id);
        setMessages((prev) => [...prev, message]);
      },
      (err: unknown) => {
        console.error('[ServiceChat] Subscription error:', err);
      },
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [serviceId, churchId, isDemo]);

  // ─── Auto-scroll on new messages ────────────────────────────────────────────

  useEffect(() => {
    if (messages.length === 0) return;
    if (isNearBottomRef.current) {
      // Use instant jump on first load, smooth thereafter
      const behavior = isInitialLoadRef.current ? 'auto' : 'smooth';
      isInitialLoadRef.current = false;
      // Use rAF to ensure DOM has painted the new content
      requestAnimationFrame(() => scrollToBottom(behavior));
    }
  }, [messages, scrollToBottom]);

  // ─── Mark messages as read ──────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || messages.length === 0 || isDemo || hasMarkedReadRef.current) return;

    const hasUnreadFromOthers = messages.some(
      (m) => m.sender_user_id !== currentUser.id && m.read_at === null,
    );
    if (!hasUnreadFromOthers) return;

    hasMarkedReadRef.current = true;
    db.serviceChat
      .markAsRead(serviceId, churchId, currentUser.id)
      .catch((err: unknown) => {
        console.error('[ServiceChat] Error marking as read:', err);
        hasMarkedReadRef.current = false; // Allow retry next time
      });
  }, [messages, currentUser, serviceId, churchId, isDemo]);

  // ─── Send message (optimistic) ──────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || !currentUser || sending) return;

    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: Message = {
      id: tempId,
      chat_id: serviceId,
      content,
      created_at: new Date().toISOString(),
      sender_user_id: currentUser.id,
      read_at: null,
      sender: {
        id: currentUser.id,
        name: currentUser.name || 'You',
        avatar_url: currentUser.avatar_url,
      },
    };

    // Optimistic update
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');
    resetTextareaHeight();
    setSending(true);
    setError(null);
    isNearBottomRef.current = true; // Force scroll to bottom for optimistic message

    try {
      const message = await db.serviceChat.createMessage(serviceId, churchId, currentUser.id, content);

      // Replace optimistic message with real one (dedup-safe)
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (message && !messageIdSetRef.current.has(message.id)) {
          messageIdSetRef.current.add(message.id);
          return [...withoutTemp, message];
        }
        return withoutTemp;
      });
    } catch (err) {
      console.error('[ServiceChat] Failed to send message:', err);
      // Remove the optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // Restore text so user doesn't lose their message
      setInputValue(content);
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [inputValue, currentUser, sending, serviceId, churchId, resetTextareaHeight]);

  // ─── Input handlers ──────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send; Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Compute render items (date separators + grouped messages) ──────────────

  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    const currentUserId = currentUser?.id;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;

      // Date separator on new day
      if (!prev || isNewDay(prev.created_at, msg.created_at)) {
        items.push({ type: 'date', key: `date-${msg.id}`, label: getDateSeparator(msg.created_at) });
      }

      const isFirstInGroup =
        !prev ||
        prev.sender_user_id !== msg.sender_user_id ||
        isNewDay(prev.created_at, msg.created_at) ||
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() >= GROUP_WINDOW_MS;

      const isLastInGroup =
        !next ||
        next.sender_user_id !== msg.sender_user_id ||
        isNewDay(msg.created_at, next.created_at) ||
        new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() >= GROUP_WINDOW_MS;

      items.push({
        type: 'message',
        key: msg.id,
        message: msg,
        isOwn: msg.sender_user_id === currentUserId,
        isFirstInGroup,
        isLastInGroup,
      });
    }

    return items;
  }, [messages, currentUser?.id]);

  // ─── Not signed in ───────────────────────────────────────────────────────────

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm text-gray-500">Sign in to participate in the chat.</p>
      </div>
    );
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            {i % 2 === 0 && <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />}
            <div className="space-y-2">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className={`h-8 ${i % 2 === 0 ? 'w-56' : 'w-44'} bg-gray-200 rounded-2xl animate-pulse`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── Error state (no messages loaded) ────────────────────────────────────────

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-gray-500 mb-3">{error}</p>
        <button
          onClick={loadMessages}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Inline error banner (messages exist) */}
      {error && messages.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between gap-2">
          <p className="text-xs text-red-600 truncate">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0" aria-label="Dismiss error">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages scroll area */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-2 sm:px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-medium text-gray-500 mb-1">No messages yet</p>
              <p className="text-xs text-gray-400">Start the conversation for this service.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderItems.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex items-center justify-center my-4">
                      <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                        {item.label}
                      </span>
                    </div>
                  );
                }

                const { message, isOwn, isFirstInGroup, isLastInGroup } = item;

                return (
                  <div
                    key={item.key}
                    className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
                      isFirstInGroup ? 'mt-3' : 'mt-0.5'
                    }`}
                  >
                    {/* Avatar (others only — shown on last message of group) */}
                    {!isOwn && (
                      <div className="w-8 flex-shrink-0 flex items-end pb-0.5">
                        {isLastInGroup && (
                          <Avatar
                            name={message.sender.name}
                            src={message.sender.avatar_url}
                            size="sm"
                            className="w-8 h-8"
                          />
                        )}
                      </div>
                    )}

                    <div
                      className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${
                        isOwn ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* Sender name */}
                      {!isOwn && isFirstInGroup && (
                        <span className="text-xs font-medium text-gray-600 ml-1 mb-0.5">
                          {message.sender.name}
                        </span>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm ${
                          isOwn
                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md'
                        }`}
                      >
                        {message.content}
                      </div>

                      {/* Timestamp + read receipt (last in group) */}
                      {isLastInGroup && (
                        <div
                          className={`flex items-center gap-1.5 mt-0.5 px-1 ${
                            isOwn ? 'flex-row-reverse' : 'flex-row'
                          }`}
                        >
                          <span className="text-[11px] text-gray-400">
                            {formatTime(message.created_at)}
                          </span>
                          {isOwn && message.read_at && (
                            <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Read
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scroll-to-bottom floating button */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            aria-label="Scroll to latest messages"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={sending}
            className="flex-1 resize-none px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 max-h-[120px]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputValue.trim()}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        {/* Character count (only when approaching limit) */}
        {inputValue.length > MAX_MESSAGE_LENGTH * 0.8 && (
          <p className="text-xs text-gray-400 mt-1 text-right">
            {inputValue.length} / {MAX_MESSAGE_LENGTH}
          </p>
        )}
      </div>
    </div>
  );
}