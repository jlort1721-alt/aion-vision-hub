import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Settings, FileText } from 'lucide-react';

const WhatsAppConfig = lazy(() => import('@/components/whatsapp/WhatsAppConfig'));
const WhatsAppConversations = lazy(() => import('@/components/whatsapp/WhatsAppConversations'));
const WhatsAppTemplates = lazy(() => import('@/components/whatsapp/WhatsAppTemplates'));

function TabLoader() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp Business</h1>
        <p className="text-muted-foreground">
          Manage WhatsApp conversations, AI agent, and configuration
        </p>
      </div>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversations
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          <Suspense fallback={<TabLoader />}>
            <WhatsAppConversations />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates">
          <Suspense fallback={<TabLoader />}>
            <WhatsAppTemplates />
          </Suspense>
        </TabsContent>

        <TabsContent value="config">
          <Suspense fallback={<TabLoader />}>
            <WhatsAppConfig />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
