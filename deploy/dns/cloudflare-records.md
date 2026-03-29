# Cloudflare DNS Records — aionseg.co

> All records below must be created in the Cloudflare dashboard for the
> **aionseg.co** zone. They harden the domain against email spoofing and
> establish trust with mail providers even though we do **not** send email
> from this domain.

---

## 1. SPF — Reject All

| Field | Value |
|-------|-------|
| Type  | TXT   |
| Name  | `@` (aionseg.co) |
| Content | `v=spf1 -all` |
| TTL   | Auto  |
| Proxy | DNS only (grey cloud) |

> `-all` tells receivers that **no** server is authorised to send mail on
> behalf of aionseg.co.

---

## 2. DKIM — Empty (no email sending)

No DKIM record is required when the domain does not send email. The SPF
`-all` and DMARC `p=reject` combination is sufficient.

If a future service requires DKIM, generate a key pair and publish the
public key as a TXT record at `<selector>._domainkey.aionseg.co`.

---

## 3. DMARC — Reject Policy

| Field | Value |
|-------|-------|
| Type  | TXT   |
| Name  | `_dmarc` |
| Content | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; rua=mailto:dmarc-reports@aionseg.co; fo=1` |
| TTL   | Auto  |
| Proxy | DNS only (grey cloud) |

> `p=reject` instructs receivers to **reject** any message that fails
> both SPF and DKIM alignment.
> `rua` can be pointed to a monitoring mailbox or an external service
> (e.g., `mailto:xxxx@dmarc.report-uri.com`) — update as needed.

---

## 4. DNSSEC — Enable in Cloudflare

DNSSEC signs zone data so resolvers can verify it has not been tampered
with in transit.

### Steps

1. **Cloudflare dashboard** → DNS → Settings → DNSSEC → **Enable DNSSEC**.
2. Cloudflare will display a **DS record**. Copy the four values:
   - Key Tag
   - Algorithm
   - Digest Type
   - Digest
3. Log in to the **domain registrar** for `aionseg.co` and add the DS
   record in the DNSSEC / DS Records section.
4. Save and wait for propagation (up to 24 hours, typically < 1 hour with
   Cloudflare).
5. Verify:
   ```bash
   dig +dnssec aionseg.co A
   # Look for the "ad" (Authenticated Data) flag in the response header
   ```

---

## 5. Verification Commands

### SPF

```bash
dig TXT aionseg.co +short
# Expected: "v=spf1 -all"
```

Online: <https://mxtoolbox.com/SuperTool.aspx?action=spf%3aaionseg.co>

### DMARC

```bash
dig TXT _dmarc.aionseg.co +short
# Expected: "v=DMARC1; p=reject; ..."
```

Online: <https://mxtoolbox.com/SuperTool.aspx?action=dmarc%3aaionseg.co>

### DNSSEC

```bash
dig +dnssec aionseg.co A
# Look for RRSIG records and the "ad" flag
```

Online: <https://mxtoolbox.com/SuperTool.aspx?action=dnssec%3aaionseg.co>

### Full domain health check

<https://mxtoolbox.com/SuperTool.aspx?action=mx%3aaionseg.co>

---

## Quick-Reference Table

| Record  | Type | Name      | Content                                           |
|---------|------|-----------|----------------------------------------------------|
| SPF     | TXT  | `@`       | `v=spf1 -all`                                     |
| DMARC   | TXT  | `_dmarc`  | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; rua=mailto:dmarc-reports@aionseg.co; fo=1` |
| DNSSEC  | DS   | *(at registrar)* | *(provided by Cloudflare after enabling)*   |
