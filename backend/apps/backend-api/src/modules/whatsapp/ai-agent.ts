/**
 * WhatsApp AI Agent
 *
 * Handles automatic AI responses for inbound messages when the conversation
 * is in "ai_bot" mode. Delegates to the AI Bridge for actual LLM calls.
 * Supports:
 *   - Context-aware responses based on conversation section
 *   - Handoff triggers (keyword detection)
 *   - Quick reply generation
 *   - Per-tenant system prompts
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { waConversations, waMessages } from '../../db/schema/index.js';
import { aiBridgeService } from '../ai-bridge/service.js';
import { whatsappService } from './service.js';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'whatsapp-ai-agent' });

const HANDOFF_KEYWORDS = [
  'hablar con humano',
  'agente humano',
  'operador',
  'human',
  'agent',
  'speak to someone',
  'talk to a person',
  'help me',
  'ayuda real',
];

const DEFAULT_SYSTEM_PROMPT = `You are AION Assistant, the AI agent for AION Vision Hub — a security and surveillance platform.
You assist customers via WhatsApp with:
- Security event inquiries
- Device status checks
- Incident reports
- General platform questions

Rules:
- Be concise and helpful. WhatsApp messages should be short.
- If the user wants to speak to a human, immediately trigger handoff.
- Do NOT share sensitive credentials or system internals.
- If you don't know the answer, say so and offer to connect them with an agent.
- Respond in the same language the user writes in.`;

export class WhatsAppAIAgent {
  /**
   * Process an inbound message through the AI agent if the conversation is in ai_bot mode.
   * Returns true if the message was handled by AI.
   */
  async handleInboundMessage(
    tenantId: string,
    conversationId: string,
    messageBody: string,
    contactPhone: string,
  ): Promise<boolean> {
    // Check conversation status
    const [conversation] = await db
      .select()
      .from(waConversations)
      .where(and(eq(waConversations.id, conversationId), eq(waConversations.tenantId, tenantId)))
      .limit(1);

    if (!conversation || conversation.status !== 'ai_bot') {
      return false;
    }

    // Check if AI agent is enabled for this tenant
    let config;
    try {
      config = await whatsappService.getConfig(tenantId);
    } catch {
      return false;
    }

    if (!config.aiAgentEnabled) return false;

    // Check for handoff keywords
    const lowerBody = messageBody.toLowerCase().trim();
    if (HANDOFF_KEYWORDS.some((kw) => lowerBody.includes(kw))) {
      await this.triggerHandoff(tenantId, conversationId, contactPhone);
      return true;
    }

    // Build conversation context from recent messages
    const recentMessages = await db
      .select()
      .from(waMessages)
      .where(
        and(
          eq(waMessages.tenantId, tenantId),
          eq(waMessages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(waMessages.createdAt))
      .limit(10);

    // Reverse to chronological order
    const chatHistory = recentMessages.reverse().map((m) => ({
      role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: m.body || '',
    }));

    // Build system prompt with section context
    const systemPrompt = this.buildSystemPrompt(
      config.aiSystemPrompt || DEFAULT_SYSTEM_PROMPT,
      conversation.sectionContext,
    );

    try {
      const aiResponse = await aiBridgeService.chat(
        {
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatHistory,
          ],
          maxTokens: 300,
          temperature: 0.7,
        },
        tenantId,
        'ai-agent',
      );

      // Send AI response via WhatsApp
      await whatsappService.sendMessage(
        tenantId,
        { to: contactPhone, type: 'text', body: aiResponse.content },
        'ai_bot',
        'AION Assistant',
      );

      logger.info(
        { tenantId, conversationId, tokens: aiResponse.tokens },
        'AI agent response sent',
      );

      return true;
    } catch (err) {
      logger.error({ err, tenantId, conversationId }, 'AI agent failed');

      // Send fallback message
      try {
        await whatsappService.sendMessage(
          tenantId,
          {
            to: contactPhone,
            type: 'text',
            body: 'I\'m having trouble processing your message right now. Let me connect you with a team member.',
          },
          'system',
          'System',
        );
        await this.triggerHandoff(tenantId, conversationId, contactPhone);
      } catch (fallbackErr) {
        logger.error({ fallbackErr, tenantId }, 'Fallback message also failed');
      }

      return true;
    }
  }

  private async triggerHandoff(
    tenantId: string,
    conversationId: string,
    contactPhone: string,
  ): Promise<void> {
    await whatsappService.handoffToHuman(tenantId, {
      conversationId,
      note: 'Customer requested human assistance',
    });

    await whatsappService.sendMessage(
      tenantId,
      {
        to: contactPhone,
        type: 'text',
        body: 'I\'m connecting you with a team member. Someone will be with you shortly.',
      },
      'system',
      'AION Assistant',
    );

    logger.info({ tenantId, conversationId }, 'AI handoff to human triggered');
  }

  private buildSystemPrompt(basePrompt: string, sectionContext?: string | null): string {
    let prompt = basePrompt;

    if (sectionContext) {
      prompt += `\n\nCurrent context/section: ${sectionContext}. Tailor your responses to this area when relevant.`;
    }

    prompt += '\n\nIf the user asks to speak with a human, respond ONLY with: "Connecting you with a team member now."';

    return prompt;
  }
}

export const whatsappAIAgent = new WhatsAppAIAgent();
