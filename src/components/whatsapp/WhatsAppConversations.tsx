import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  MessageSquare, Send, UserCheck, X, Bot, User, Phone,
  Loader2, RefreshCw, ArrowRight, Search, Clock, AlertTriangle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

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

// ── Constants ────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────

export default function WhatsAppConversations() {
  const queryClient = useQueryClient();

  // Filters & selection
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Handoff dialog
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [handoffNote, setHandoffNote] = useState('');
  const [handoffAssignTo, setHandoffAssignTo] = useState('');

  // Close dialog
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeResolution, setCloseResolution] = useState('');

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ──────────────────────────────────────────────

  const { data: convsData, isLoading: loadingConvs } = useQuery({
    queryKey: ['whatsapp-conversations', statusFilter],
    queryFn: () =>
      apiClient.edgeFunction<any>('whatsapp-api', { action: 'conversations', ...(statusFilter !== 'all' ? { status: statusFilter } : {}) } as Record<string, string>, { method: 'GET' }),
    refetchInterval: 10_000,
  });

  const allConversations: Conversation[] = convsData?.data || [];

  // Client-side search filter
  const conversations = allConversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (conv.wa_contact_phone || '').toLowerCase().includes(q) ||
      (conv.wa_contact_name && conv.wa_contact_name.toLowerCase().includes(q))
    );
  });

  const { data: msgsData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['whatsapp-messages', selectedConvId],
    queryFn: () => apiClient.edgeFunction<any>('whatsapp-api', { action: 'messages', conversationId: selectedConvId!, limit: '100' }, { method: 'GET' }),
    enabled: !!selectedConvId,
    refetchInterval: 5_000,
  });

  const messages: Message[] = (msgsData?.data || []).slice().reverse();

  const selectedConv = allConversations.find((c) => c.id === selectedConvId);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Mutations ────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      apiClient.edgeFunction<any>('whatsapp-api', { action: 'send' }, { method: 'POST', body: JSON.stringify({ to: selectedConv!.wa_contact_phone, type: 'text', body: text }) }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConvId] });
      toast.success('Message sent');
    },
    onError: (err: Error) => toast.error(`Send failed: ${err.message}`),
  });

  const handoffMutation = useMutation({
    mutationFn: () =>
      apiClient.edgeFunction<any>('whatsapp-api', { action: 'handoff' }, { method: 'POST', body: JSON.stringify({ conversationId: selectedConvId!, assignTo: handoffAssignTo || undefined, note: handoffNote || undefined }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Handed off to human agent');
      setHandoffDialogOpen(false);
      setHandoffNote('');
      setHandoffAssignTo('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiClient.edgeFunction<any>('whatsapp-api', { action: 'close' }, { method: 'POST', body: JSON.stringify({ conversationId: selectedConvId!, resolution: closeResolution || undefined }) }),
    onSuccess: () => {
      setSelectedConvId(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conversation closed');
      setCloseDialogOpen(false);
      setCloseResolution('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const quickReplyMutation = useMutation({
    mutationFn: (buttons: Array<{ id: string; title: string }>) =>
      apiClient.edgeFunction<any>('whatsapp-api', { action: 'quick-reply' }, { method: 'POST', body: JSON.stringify({ to: selectedConv!.wa_contact_phone, body: 'Please select an option:', buttons }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConvId] });
      toast.success('Quick reply sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Counters ─────────────────────────────────────────────

  const activeBotCount = allConversations.filter((c) => c.status === 'ai_bot').length;
  const activeHumanCount = allConversations.filter((c) => c.status === 'human_agent').length;

  // ── Render ───────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-14rem)]">
        {/* Conversation List */}
        <Card className="md:col-span-1 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Conversations</CardTitle>
              <div className="flex items-center gap-1">
                {activeBotCount > 0 && (
                  <Badge variant="default" className="text-[10px] gap-1 px-1.5">
                    <Bot className="h-2.5 w-2.5" />
                    {activeBotCount}
                  </Badge>
                )}
                {activeHumanCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
                    <User className="h-2.5 w-2.5" />
                    {activeHumanCount}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
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
                <div className="flex flex-col items-center py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {allConversations.length === 0
                      ? 'No conversations yet'
                      : 'No conversations match your search'}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear search
                    </Button>
                  )}
                </div>
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
                        {(conv.status || '').replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {conv.wa_contact_phone}
                    </div>
                    {conv.assigned_to && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <UserCheck className="h-2.5 w-2.5" />
                        {conv.assigned_to}
                      </div>
                    )}
                    {conv.last_message_at && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(conv.last_message_at).toLocaleString()}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground text-center">
            {conversations.length} of {allConversations.length} conversation{allConversations.length !== 1 ? 's' : ''}
          </div>
        </Card>

        {/* Chat / Messages */}
        <Card className="md:col-span-2 flex flex-col">
          {!selectedConvId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a conversation to view messages</p>
                <p className="text-xs mt-1 opacity-50">
                  Messages auto-refresh every 5 seconds
                </p>
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{selectedConv?.wa_contact_phone}</p>
                      {selectedConv && (
                        <Badge variant={STATUS_COLORS[selectedConv.status]} className="gap-1 text-[10px] px-1.5">
                          {STATUS_ICONS[selectedConv.status]}
                          {(selectedConv?.status || '').replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConv?.status !== 'closed' && (
                      <>
                        {selectedConv?.status === 'ai_bot' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setHandoffDialogOpen(true)}
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
                          onClick={() => setCloseDialogOpen(true)}
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
                    {messages.map((msg) => {
                      const isOutbound = msg.direction === 'outbound';
                      const isAiBot = msg.sender_type === 'ai_bot';
                      const isSystem = msg.sender_type === 'system';

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 ${
                              isOutbound
                                ? isAiBot
                                  ? 'bg-primary/20 text-primary-foreground'
                                  : isSystem
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-primary text-primary-foreground'
                                : 'bg-accent'
                            }`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] font-medium opacity-70">
                                {isAiBot && <Bot className="h-2.5 w-2.5 inline mr-0.5" />}
                                {isSystem && <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />}
                                {msg.sender_name || msg.sender_type}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                            <div className="flex items-center justify-between mt-1 gap-2">
                              <span className="text-[10px] opacity-50">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </span>
                              {msg.delivery_status && isOutbound && (
                                <span className="text-[10px] opacity-50">{msg.delivery_status}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Reply Input */}
              {selectedConv?.status !== 'closed' ? (
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
              ) : (
                <div className="p-3 border-t text-center text-sm text-muted-foreground">
                  This conversation is closed.
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* ── Handoff Dialog ──────────────────────────────────── */}
      <Dialog open={handoffDialogOpen} onOpenChange={setHandoffDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Handoff to Human Agent</DialogTitle>
            <DialogDescription>
              Transfer this conversation from AI bot to a human agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="handoff-assign">Assign To (optional)</Label>
              <Input
                id="handoff-assign"
                value={handoffAssignTo}
                onChange={(e) => setHandoffAssignTo(e.target.value)}
                placeholder="Agent email or ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="handoff-note">Handoff Note (optional)</Label>
              <Textarea
                id="handoff-note"
                value={handoffNote}
                onChange={(e) => setHandoffNote(e.target.value)}
                placeholder="Context or reason for handoff..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoffDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handoffMutation.mutate()}
              disabled={handoffMutation.isPending}
            >
              {handoffMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <UserCheck className="h-4 w-4 mr-1" />
              Confirm Handoff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Close Conversation Dialog ───────────────────────── */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Conversation</DialogTitle>
            <DialogDescription>
              Close this conversation. The contact can start a new one by sending a message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="close-resolution">Resolution Notes (optional)</Label>
              <Textarea
                id="close-resolution"
                value={closeResolution}
                onChange={(e) => setCloseResolution(e.target.value)}
                placeholder="How was this conversation resolved..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <X className="h-4 w-4 mr-1" />
              Close Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
