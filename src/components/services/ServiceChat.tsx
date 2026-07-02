'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { formatRelativeDate } from '@/lib/formatDate';
import { db } from '@/lib/store';
import type { User } from '@/lib/types';

interface Message {
  id: string;
  chat_id: string;
  content: string;
  created_at: string;
  sender_user_id: string;
  read_by?: string[]; // user IDs who have read this message
  sender: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

interface TypingUser {
  userId: string;
  name: string;
  timestamp: number;
}

interface ServiceChatProps {
  serviceId: string;
  churchId: string;
  currentUser: User | null;
  isDemo?: boolean;
}

export function ServiceChat({ serviceId, churchId, currentUser, isDemo = false }: ServiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReadMessageId = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const msgs = await db.serviceChat.getMessages(serviceId, churchId);
      setMessages(msgs);
    } catch (error) {
      console.error('[ServiceChat] Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [serviceId, churchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isDemo) return; // Demo doesn't support real-time subscriptions

    const unsubscribe = db.serviceChat.subscribe(
      serviceId,
      churchId,
      (message) => {
        setMessages((prev) => [...prev, message]);
      },
      (error) => {
        console.error('[ServiceChat] Subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [serviceId, churchId, isDemo]);

  // Mark messages as read when they're visible
  const markMessagesAsRead = useCallback(async () => {
    if (!currentUser || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) => m.sender_user_id !== currentUser.id && !m.read_by?.includes(currentUser.id)
    );

    if (unreadMessages.length === 0) return;

    const lastMessage = unreadMessages[unreadMessages.length - 1];
    if (lastReadMessageId.current === lastMessage.id) return;

    lastReadMessageId.current = lastMessage.id;

    try {
      await db.serviceChat.markAsRead(serviceId, lastMessage.id, currentUser.id);
    } catch (error) {
      console.error('[ServiceChat] Error marking as read:', error);
    }
  }, [currentUser, messages, serviceId]);

  // Mark messages as read when messages change
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages, markMessagesAsRead]);

  // Cleanup expired typing indicators
  useEffect(() => {
    if (typingUsers.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((u) => now - u.timestamp < 5000));
    }, 1000);

    return () => clearInterval(interval);
  }, [typingUsers.length]);

  // Handle typing indicator on input change
  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!currentUser) return;

    // Broadcast typing indicator (debounced)
    if (!isTyping) {
      setIsTyping(true);
      // In a real implementation, this would broadcast to other clients
      // via Supabase realtime or a presence channel
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentUser || sending) {
      return;
    }

    try {
      setSending(true);
      const message = await db.serviceChat.createMessage(
        serviceId,
        churchId,
        currentUser.id,
        newMessage
      );
      
      if (message) {
        setMessages((prev) => [...prev, message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('[ServiceChat] Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_user_id === currentUser?.id;
            
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
              >
                <Avatar
                  name={message.sender.name}
                  src={message.sender.avatar_url}
                  size="sm"
                  className="flex-shrink-0"
                />
                <div
                  className={`flex flex-col max-w-[70%] ${
                    isOwnMessage ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.sender.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeDate(message.created_at)}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                  {/* Read receipts for own messages */}
                  {isOwnMessage && message.read_by && message.read_by.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Read by {message.read_by.length}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-400 italic">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].name} is typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTypingChange}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending || !currentUser}
            maxLength={2000}
          />
          <Button
            type="submit"
            disabled={sending || !newMessage.trim() || !currentUser}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {newMessage.length} / 2000 characters
        </p>
      </form>
    </div>
  );
}