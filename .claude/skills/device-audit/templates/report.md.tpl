# Device Audit — $timestamp

**Mode:** $mode
**Filters:** brand=$brand_filter, site=$site_filter, device=$device_filter

## Summary

- Total matched: **$total**
- Fresh (last_seen < 6h): **$fresh**
- Stale (last_seen ≥ 6h): **$stale**
- Never seen: **$never**

## Devices

| name | brand | site | target | last_seen | dry_status |
|---|---|---|---|---|---|
$body
