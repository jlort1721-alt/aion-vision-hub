import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';

export async function registerProvisioningRoutes(app: FastifyInstance) {
  // Serve Fanvil config by MAC address
  // GET /provisioning/:mac.cfg — no auth required (phones can't authenticate)
  app.get('/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const mac = filename.replace('.cfg', '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();

    if (mac.length !== 12) {
      return reply.code(404).send('Invalid MAC');
    }

    // Look up device by MAC address in the database
    try {
      const results = await db.execute(
        sql`SELECT d.name, d.ip_address, d.port, d.username, d.password, s.name as site_name
            FROM devices d LEFT JOIN sites s ON d.site_id = s.id
            WHERE LOWER(REPLACE(d.mac_address, ':', '')) = ${mac}
            LIMIT 1`
      );

      const device = (results as unknown as Record<string, unknown>[])[0];
      const siteName = (device?.site_name as string) || 'AION';
      const extension = (device?.username as string) || mac.slice(-4);
      const password = (device?.password as string) || process.env.SIP_DEFAULT_PASSWORD || '';

      // Generate Fanvil .cfg format
      const config = `
<<VOIP CONFIG>>
[Account1]
Enable = 1
Label = ${siteName}
DisplayName = ${siteName}
UserName = ${extension}
AuthName = ${extension}
Password = ${password}
SIPServerAddr = ${process.env.SIP_SERVER_ADDR || '0.0.0.0'}
SIPServerPort = 5061
TransportType = 4
OutboundProxyAddr = ${process.env.SIP_SERVER_ADDR || '0.0.0.0'}
OutboundProxyPort = 5061

[Auto Answer]
AutoAnswerEnable = 1
AutoAnswerMode = 0
AutoAnswerDelay = 0

[Intercom]
IntercomEnable = 1
IntercomMuteEnable = 0
IntercomToneEnable = 1
IntercomBargeEnable = 1

[DSS Key]
DSSKey1Type = 0
DSSKey1Value = 100
DSSKey1Label = Emergencia
DSSKey2Type = 0
DSSKey2Value = 200
DSSKey2Label = Monitoreo

[Time]
TimeZone = -5
NTPEnable = 1
NTPServer = pool.ntp.org
`.trim();

      reply.header('Content-Type', 'text/plain');
      return reply.send(config);
    } catch {
      // Default config for unknown devices
      const config = `
<<VOIP CONFIG>>
[Account1]
Enable = 1
Label = AION
DisplayName = AION Phone
UserName = ${mac.slice(-4)}
AuthName = ${mac.slice(-4)}
Password = aion2026
SIPServerAddr = ${process.env.SIP_SERVER_ADDR || '0.0.0.0'}
SIPServerPort = 5061
TransportType = 4

[Auto Answer]
AutoAnswerEnable = 1

[Time]
TimeZone = -5
NTPEnable = 1
NTPServer = pool.ntp.org
`.trim();

      reply.header('Content-Type', 'text/plain');
      return reply.send(config);
    }
  });
}
