import type { FastifyInstance } from 'fastify';
import { knowledgeBase } from './service.js';
import { requireRole } from '../../plugins/auth.js';

export async function registerKnowledgeBaseRoutes(app: FastifyInstance) {
  // Search knowledge base
  app.get('/search', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { q, limit } = request.query as { q?: string; limit?: string };
    if (!q) return reply.send({ success: true, data: [] });
    const results = await knowledgeBase.search(q, parseInt(limit || '5'));
    return reply.send({ success: true, data: results });
  });

  // List by category
  app.get('/category/:category', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { category } = request.params as { category: string };
    const results = await knowledgeBase.listByCategory(category);
    return reply.send({ success: true, data: results });
  });

  // List all entries
  app.get('/', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const results = await knowledgeBase.listAll(limit ? parseInt(limit, 10) : 50);
    return reply.send({ success: true, data: results });
  });

  // Add knowledge entry (admin only)
  app.post('/', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request, reply) => {
    const body = request.body as { category: string; title: string; content: string; tags?: string[]; source?: string };
    await knowledgeBase.add({
      category: body.category,
      title: body.title,
      content: body.content,
      tags: body.tags || [],
      source: body.source || 'manual',
    });
    return reply.code(201).send({ success: true });
  });

  // Update knowledge entry
  app.patch('/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{ category: string; title: string; content: string; tags: string[]; source: string }>;
    await knowledgeBase.update(id, body);
    await request.audit('knowledge.update', 'knowledge_base', id, body);
    return reply.send({ success: true });
  });

  // Delete knowledge entry
  app.delete('/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await knowledgeBase.remove(id);
    await request.audit('knowledge.delete', 'knowledge_base', id);
    return reply.code(204).send();
  });

  // Seed default knowledge
  app.post('/seed-defaults', { preHandler: [requireRole('super_admin')] }, async (_request, reply) => {
    const defaults = [
      { category: 'sop', title: 'Protocolo de apertura de puerta', content: 'Verificar identidad del visitante via citofono. Confirmar con el residente destino. Registrar en bitacora. Abrir puerta vehicular o peatonal segun corresponda. Verificar cierre de puerta.', tags: ['access', 'door', 'protocol'], source: 'manual' },
      { category: 'sop', title: 'Protocolo de emergencia - incendio', content: 'Activar alarma general. Contactar bomberos al 123. Evacuar zona afectada. Cortar suministro electrico de la zona. Registrar tiempo de respuesta. Notificar a supervisor.', tags: ['emergency', 'fire', 'protocol'], source: 'manual' },
      { category: 'sop', title: 'Protocolo de ronda de vigilancia', content: 'Iniciar ronda en punto de control 1. Verificar puertas y accesos en cada punto. Registrar novedades. Verificar funcionamiento de camaras. Completar ronda en tiempo maximo de 30 minutos.', tags: ['patrol', 'round', 'protocol'], source: 'manual' },
      { category: 'device_manual', title: 'Hikvision DVR - Reinicio remoto', content: 'Acceder via iVMS-4200 o navegador web. Menu Sistema > Mantenimiento > Reiniciar. Esperar 2-3 minutos. Verificar reconexion. Si no responde, verificar alimentacion electrica y red.', tags: ['hikvision', 'dvr', 'reboot'], source: 'manual' },
      { category: 'device_manual', title: 'Dahua XVR - Acceso por serial', content: 'Abrir DMSS o SmartPSS. Agregar dispositivo por numero de serie. Ingresar credenciales del equipo. Verificar canales de video. Si falla, verificar que el equipo tenga conexion a internet.', tags: ['dahua', 'xvr', 'serial', 'p2p'], source: 'manual' },
      { category: 'system_pattern', title: 'Dispositivo offline frecuente', content: 'Si un dispositivo se desconecta mas de 3 veces en 24 horas, verificar: 1) Calidad de la conexion de internet de la sede. 2) Estado del router/switch. 3) Alimentacion electrica del equipo. 4) Cable de red. Escalar a tecnico si persiste.', tags: ['troubleshooting', 'offline', 'pattern'], source: 'ai_generated' },
    ];
    for (const d of defaults) {
      try { await knowledgeBase.add(d); } catch { /* skip duplicates */ }
    }
    return reply.send({ success: true, data: { seeded: defaults.length } });
  });
}
