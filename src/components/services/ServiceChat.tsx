'use client';

import { useState, useEffect, useRef } from 'react';
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

export function ServiceChat({ serviceId, churchId, currentUser, isDemo = false }: ServiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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