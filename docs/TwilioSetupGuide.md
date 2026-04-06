# Twilio Setup Guide for AION

Guide for configuring Twilio in the AION platform — WhatsApp Business, voice calls to Colombia, and SMS.

## 1. Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Register with corporate email
3. Verify email and phone
4. Get free trial credit ($15 USD)

## 2. Get Credentials

From the Twilio Console Dashboard (https://console.twilio.com):

- Copy **Account SID** (starts with `AC`)
- Copy **Auth Token**

Add to the backend `.env`:
```
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token
```

## 3. Buy a Colombian Number

1. Console > Phone Numbers > Buy a Number
2. Filter: Country = Colombia, Capabilities = Voice + SMS
3. Purchase a local number (+57...)
4. Cost: ~$3-8 USD/month

If no Colombian numbers are available, use a US number and verify your caller ID.

Add to `.env`:
```
TWILIO_PHONE_NUMBER=+573XXXXXXXXX
```

## 4. Configure WhatsApp

### Option A: Sandbox (testing)

1. Console > Messaging > Try it Out > Send a WhatsApp message
2. Follow sandbox instructions (send "join <word>" to the sandbox number)
3. Set sandbox webhook: `https://aionseg.co/webhooks/twilio/whatsapp-incoming`

### Option B: Production (WhatsApp Business)

1. Console > Messaging > Senders > WhatsApp Senders
2. Click "Register WhatsApp Sender"
3. Requires Facebook Business Manager (verified)
4. Business name: "Clave Seguridad CTA"
5. Associate your Colombian number
6. Approval time: 7-14 days

Add to `.env`:
```
TWILIO_WHATSAPP_FROM=whatsapp:+573XXXXXXXXX
```

## 5. Create TwiML App (browser calls)

1. Console > Voice > TwiML Apps > Create
2. Name: "AION Voice App"
3. Voice Request URL: `https://aionseg.co/webhooks/twilio/call-connect`
4. Method: POST
5. Copy the TwiML App SID

Add to `.env`:
```
TWILIO_TWIML_APP_SID=APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## 6. Create API Key (voice tokens)

1. Console > Account > API Keys & Tokens > Create API Key
2. Type: Standard
3. Name: "AION Voice Key"
4. Copy API Key SID and Secret

Add to `.env`:
```
TWILIO_API_KEY_SID=SKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_API_KEY_SECRET=your_api_secret
```

## 7. Configure Webhooks

Go to Phone Numbers > Active Numbers > your number:

**Voice & Fax:**
- A CALL COMES IN: Webhook > `https://aionseg.co/webhooks/twilio/call-connect` > POST
- CALL STATUS CHANGES: `https://aionseg.co/webhooks/twilio/call-status` > POST

**Messaging:**
- A MESSAGE COMES IN: Webhook > `https://aionseg.co/webhooks/twilio/whatsapp-incoming` > POST

## 8. Webhook Base URL

Add to `.env`:
```
TWILIO_WEBHOOK_BASE=https://aionseg.co/webhooks/twilio
```

## 9. WhatsApp Templates (production)

1. Console > Messaging > Content Template Builder
2. Create templates for: security notifications, welcome, reminders, alerts
3. Submit for WhatsApp/Meta approval
4. Use the Content SID in API calls

## 10. Cost Estimates

| Item | Cost (USD) |
|------|-----------|
| Colombian number | $3-8/month |
| WhatsApp per message (Twilio fee) | $0.005/msg |
| WhatsApp template (Meta fee) | $0.02-0.08/msg |
| Call to Colombian mobile | ~$0.04-0.09/min |
| Call to Colombian landline | ~$0.02-0.05/min |
| SMS to Colombia | ~$0.04-0.05/msg |
| Call recording | $0.0025/min |

**Monthly estimate (moderate use: 500 WhatsApp, 100 calls x 2min, 50 SMS):**
- WhatsApp: 500 x $0.005 = $2.50 + Meta fees ~$10-40
- Calls: 200 min x $0.065 = $13
- SMS: 50 x $0.045 = $2.25
- Number: $5
- **Total: ~$33-63 USD/month**

## 11. Complete .env Reference

```bash
# Twilio Core
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+573XXXXXXXXX

# WhatsApp
TWILIO_WHATSAPP_FROM=whatsapp:+573XXXXXXXXX

# Voice (browser calls)
TWILIO_TWIML_APP_SID=APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_API_KEY_SID=SKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_API_KEY_SECRET=your_api_secret

# Webhooks
TWILIO_WEBHOOK_BASE=https://aionseg.co/webhooks/twilio
```

## 12. Nginx Configuration

Add to the Nginx config for aionseg.co:

```nginx
location /webhooks/twilio/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Twilio-Signature $http_x_twilio_signature;
}
```

## 13. Verify Integration

```bash
# Test WhatsApp
curl -X POST https://aionseg.co/api/twilio/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"to": "3XXXXXXXXX", "message": "Test desde AION"}'

# Test call
curl -X POST https://aionseg.co/api/twilio/calls/make \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"to": "3XXXXXXXXX", "message": "Prueba del sistema AION."}'

# Test SMS
curl -X POST https://aionseg.co/api/twilio/sms/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"to": "3XXXXXXXXX", "message": "Test SMS desde AION"}'

# Check logs
curl https://aionseg.co/api/twilio/logs?limit=5 \
  -H "Authorization: Bearer YOUR_JWT"

# Check stats
curl https://aionseg.co/api/twilio/stats \
  -H "Authorization: Bearer YOUR_JWT"

# Health check
curl https://aionseg.co/api/twilio/health \
  -H "Authorization: Bearer YOUR_JWT"
```
