import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { whatsappApi } from '@/services/api';
import {
  MessageSquare, Send, UserCheck, X, Bot, User, Phone,
  Loader2, RefreshCw, ArrowRight,
} from 'lucide-react';

interface Conversation {
  id: string;
  wa_contact_phone: string;
  wa_contact_name: string | null;
  status: 'ai_bot' | 'human_agent' | 'closed';
  assigned_to: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  sender_type: string;
  sender_name: string | null;
  body: string | null;
  delivery_status: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ai_bot: 'default',
  human_agent: 'secondary',
  closed: 'destructive',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  ai_bot: <Bot className="h-3 w-3" />,
  human_agent: <User className="h-3 w-3" />,
  closed: <X className="h-3 w-3" />,
};

export default function WhatsAppConversations() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: convsData, isLoading: loadingConvs } = useQuery({
    queryKey: ['whatsapp-conversations', statusFilter],
    queryFn: () =>
      whatsappApi.listConversations(
        statusFilter !== 'all' ? { status: statusFilter } : undefined,
      ),
    refetchInterval: 10_000,
  });

  const conversations: Conversation[] = convsData?.data || [];

  const { data: msgsData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['whatsapp-messages', selectedConvId],
    queryFn: () => whatsappApi.getMessages(selectedConvId!, 100),
    enabled: !!selectedConvId,
    refetchInterval: 5_000,
  });

  const messages: Message[] = (msgsData?.data || []).slice().reverse();

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      whatsappApi.sendMessage({
        to: selectedConv!.wa_contact_phone,
        type: 'text',
        body: text,
      }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConvId] });
      toast.success('Message sent');
    },
    onError: (err: Error) => toast.error(`Send failed: ${err.message}`),
  });

  const handoffMutation = useMutation({
    mutationFn: () => whatsappApi.handoffToHuman(selectedConvId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Handed off to human agent');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => whatsappApi.closeConversation(selectedConvId!),
    onSuccess: () => {
      setSelectedConvId(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conversation closed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const quickReplyMutation = useMutation({
    mutationFn: (buttons: Array<{ id: string; title: string }>) =>
      whatsappApi.sendQuickReply({
        to: selectedConv!.wa_contact_phone,
        body: 'Please select an option:',
        buttons,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConvId] });
      toast.success('Quick reply sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-14rem)]">
      {/* Conversation List */}
      <Card className="md:col-span-1 flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Conversations</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ai_bot">AI Bot</SelectItem>
              <SelectItem value="human_agent">Human Agent</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="px-4 pb-4 space-y-1">
            {loadingConvs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No conversations yet
              </p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`w-full text-left rounded-lg p-3 transition-colors hover:bg-accent/50 ${
                    selectedConvId === conv.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedConvId(conv.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">
                      {conv.wa_contact_name || conv.wa_contact_phone}
                    </span>
                    <Badge variant={STATUS_COLORS[conv.status]} className="gap-1 text-[10px] px-1.5">
                      {STATUS_ICONS[conv.status]}
                      {conv.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {conv.wa_contact_phone}
                  </div>
                  {conv.last_message_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(conv.last_message_at).toLocaleString()}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat / Messages */}
      <Card className="md:col-span-2 flex flex-col">
        {!selectedConvId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <CardHeader className="pb-3 flex-shrink-0 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedConv?.wa_contact_name || selectedConv?.wa_contact_phone}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{selectedConv?.wa_contact_phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConv?.status !== 'closed' && (
                    <>
                      {selectedConv?.status === 'ai_bot' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handoffMutation.mutate()}
                          disabled={handoffMutation.isPending}
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Handoff
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          quickReplyMutation.mutate([
                            { id: 'yes', title: 'Yes' },
                            { id: 'no', title: 'No' },
                            { id: 'help', title: 'More help' },
                          ])
                        }
                        disabled={quickReplyMutation.isPending}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Quick Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => closeMutation.mutate()}
                        disabled={closeMutation.isPending}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Close
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 ${
                          msg.direction === 'outbound'
                            ? msg.sender_type === 'ai_bot'
                              ? 'bg-blue-600/20 text-blue-100'
                              : msg.sender_type === 'system'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary text-primary-foreground'
                            : 'bg-accent'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[10px] font-medium opacity-70">
                            {msg.sender_type === 'ai_bot' && <Bot className="h-2.5 w-2.5 inline mr-0.5" />}
                            {msg.sender_name || msg.sender_type}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <span className="text-[10px] opacity-50">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </span>
                          {msg.delivery_status && msg.direction === 'outbound' && (
                            <span className="text-[10px] opacity-50">{msg.delivery_status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Reply Input */}
            {selectedConv?.status !== 'closed' && (
              <div className="p-3 border-t flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) {
                      e.preventDefault();
                      sendMutation.mutate(replyText.trim());
                    }
                  }}
                />
                <Button
                  onClick={() => sendMutation.mutate(replyText.trim())}
                  disabled={!replyText.trim() || sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
