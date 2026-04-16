#!/usr/bin/env bash
# ops/firewall/reverse-ports.sh
#
# Opens the firewall for the reverse-connect gateway, both at the host level
# (ufw) and at the AWS Security Group level. Idempotent: safe to run twice.
# Every change is appended to /etc/aion/firewall-changelog.md with a rollback
# command so you can undo in a single line.
#
# Usage:
#   sudo ./reverse-ports.sh open   # open the 3 listener ports
#   sudo ./reverse-ports.sh close  # close them (rollback)
#
# Required environment:
#   AION_AWS_SG_ID      e.g. sg-0123456789abcdef0
#   AION_AWS_REGION     e.g. sa-east-1
#
# Ports:
#   7660/tcp  Hikvision ISUP signaling     -> 0.0.0.0/0
#   7661/tcp  Hikvision ISUP media         -> 0.0.0.0/0
#   7661/udp  Hikvision ISUP media (alt)   -> 0.0.0.0/0
#   7681/tcp  Dahua Auto Register          -> 0.0.0.0/0
#
# gRPC (50551), metrics (9464) and crypto-bridge (51551) stay loopback only.

set -euo pipefail

ACTION="${1:-}"
CHANGELOG="/etc/aion/firewall-changelog.md"
mkdir -p "$(dirname "$CHANGELOG")"
touch "$CHANGELOG"

: "${AION_AWS_SG_ID:?set AION_AWS_SG_ID}"
: "${AION_AWS_REGION:?set AION_AWS_REGION}"

PORTS_TCP=(7660 7661 7681)
PORTS_UDP=(7661)

log() {
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$CHANGELOG"
}

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "Run as root (sudo)" >&2
    exit 1
  fi
}

ensure_tools() {
  command -v ufw >/dev/null || { echo "ufw not installed"; exit 1; }
  command -v aws >/dev/null || { echo "aws CLI not installed"; exit 1; }
}

open_all() {
  log "### OPEN $(hostname) $(date -u +%FT%TZ) ###"
  for p in "${PORTS_TCP[@]}"; do
    ufw allow "${p}/tcp" comment "aion-reverse"
    aws ec2 authorize-security-group-ingress \
        --region "$AION_AWS_REGION" \
        --group-id "$AION_AWS_SG_ID" \
        --ip-permissions "IpProtocol=tcp,FromPort=${p},ToPort=${p},IpRanges=[{CidrIp=0.0.0.0/0,Description=\"aion-reverse\"}]" \
        2>/dev/null || log "SG already has TCP ${p} (ok)"
    log "open tcp ${p}  -> rollback: sudo ufw delete allow ${p}/tcp && aws ec2 revoke-security-group-ingress --region ${AION_AWS_REGION} --group-id ${AION_AWS_SG_ID} --protocol tcp --port ${p} --cidr 0.0.0.0/0"
  done
  for p in "${PORTS_UDP[@]}"; do
    ufw allow "${p}/udp" comment "aion-reverse"
    aws ec2 authorize-security-group-ingress \
        --region "$AION_AWS_REGION" \
        --group-id "$AION_AWS_SG_ID" \
        --ip-permissions "IpProtocol=udp,FromPort=${p},ToPort=${p},IpRanges=[{CidrIp=0.0.0.0/0,Description=\"aion-reverse\"}]" \
        2>/dev/null || log "SG already has UDP ${p} (ok)"
    log "open udp ${p}  -> rollback: sudo ufw delete allow ${p}/udp && aws ec2 revoke-security-group-ingress --region ${AION_AWS_REGION} --group-id ${AION_AWS_SG_ID} --protocol udp --port ${p} --cidr 0.0.0.0/0"
  done
  ufw --force reload
  log "### OPEN COMPLETE ###"
}

close_all() {
  log "### CLOSE $(hostname) $(date -u +%FT%TZ) ###"
  for p in "${PORTS_TCP[@]}"; do
    ufw delete allow "${p}/tcp" || true
    aws ec2 revoke-security-group-ingress \
        --region "$AION_AWS_REGION" \
        --group-id "$AION_AWS_SG_ID" \
        --protocol tcp --port "$p" --cidr 0.0.0.0/0 || true
    log "closed tcp ${p}"
  done
  for p in "${PORTS_UDP[@]}"; do
    ufw delete allow "${p}/udp" || true
    aws ec2 revoke-security-group-ingress \
        --region "$AION_AWS_REGION" \
        --group-id "$AION_AWS_SG_ID" \
        --protocol udp --port "$p" --cidr 0.0.0.0/0 || true
    log "closed udp ${p}"
  done
  ufw --force reload
  log "### CLOSE COMPLETE ###"
}

require_root
ensure_tools

case "$ACTION" in
  open)  open_all ;;
  close) close_all ;;
  *)     echo "Usage: $0 {open|close}"; exit 1 ;;
esac
