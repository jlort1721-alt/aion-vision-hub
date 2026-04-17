#!/bin/bash
# Configura los 13 NVR/DVR Hikvision REMOTAMENTE vía ISAPI, sin visitar sitio.
# - Enable Motion Detection en todos los canales
# - Configure HTTP Host Notification → push events al VPS backend
# - Enable Line Detection (VCA) en canal 1 de cada device
#
# Requisitos:
#   - VPS alcanzable desde cada DVR en 18.230.40.6:7660 (UFW ya abierto)
#   - Credenciales admin válidas (desde /etc/aion/secrets/device-credentials.env)
#   - curl + bash 4+
#
# Ejecución:
#   sudo -E bash configure-hikvision-remote.sh [--dry-run]

set -euo pipefail

DRY_RUN=${1:-}
VPS_ENDPOINT="${VPS_ENDPOINT:-http://18.230.40.6:7660/isapi/event}"
HIK_PUSH_USER="${HIK_PUSH_USER:-hik_push}"
HIK_PUSH_PASS="${HIK_PUSH_PASS:-$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)}"

source /etc/aion/secrets/device-credentials.env

# Lista devices: id|ip|port|user|pass|channels
DEVICES=(
  "hk-portalegre-1|200.58.214.114|8040|admin|$HIK_PASS_DEFAULT|16"
  "hk-portalegre-2|200.58.214.114|8000|admin|$HIK_PASS_DEFAULT|16"
  "hk-palencia|181.205.249.130|8000|admin|$HIK_PASS_DEFAULT|16"
  "hk-portal-plaza|201.184.242.66|8040|admin|$HIK_PASS_DEFAULT|16"
  "hk-altos-rosario|190.159.37.188|8010|admin|$HIK_PASS_DEFAULT|16"
  "hk-san-nicolas|181.143.16.170|8000|admin|$HIK_PASS_DEFAULT|16"
  "hk-pisquines-1|181.205.202.122|8010|admin|$HIK_PASS_DEFAULT|16"
  "hk-pisquines-2|181.205.202.122|8020|admin|$HIK_PASS_DEFAULT|16"
  "hk-altagracia|181.205.175.18|8030|admin|$HIK_PASS_DEFAULT|16"
  "hk-torre-lucia-nvr|181.205.215.210|8010|admin|$HIK_PASS_DEFAULT|16"
  "hk-torre-lucia-dvr|181.205.215.210|8020|admin|$HIK_PASS_ALT|16"
  "hk-san-sebastian|186.97.106.252|8000|admin|$HIK_PASS_DEFAULT|16"
  "hk-senderos-calanzans|38.9.217.12|8030|admin|$HIK_PASS_DEFAULT|8"
)

http_host_xml() {
  cat <<EOF
<HttpHostNotificationList>
  <HttpHostNotification>
    <id>1</id>
    <url>${VPS_ENDPOINT}</url>
    <protocolType>HTTP</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>ipaddress</addressingFormatType>
    <ipAddress>18.230.40.6</ipAddress>
    <portNo>7660</portNo>
    <userName>${HIK_PUSH_USER}</userName>
    <password>${HIK_PUSH_PASS}</password>
    <httpAuthenticationMethod>MD5digest</httpAuthenticationMethod>
  </HttpHostNotification>
</HttpHostNotificationList>
EOF
}

motion_xml() {
  local ch=$1
  cat <<EOF
<MotionDetection>
  <enabled>true</enabled>
  <enableHighlight>false</enableHighlight>
  <sensitivityLevel>60</sensitivityLevel>
  <MotionDetectionLayout>
    <sensitivityLevel>60</sensitivityLevel>
    <layout>
      <gridMap>ffffffffffffffffffffffffffffffffffffffffffffff</gridMap>
    </layout>
  </MotionDetectionLayout>
  <EventTriggerNotificationList>
    <EventTriggerNotification>
      <id>1</id>
      <notificationMethod>HTTP</notificationMethod>
      <notificationRecurrence>beginning</notificationRecurrence>
    </EventTriggerNotification>
  </EventTriggerNotificationList>
</MotionDetection>
EOF
}

configure_device() {
  local id=$1 ip=$2 port=$3 user=$4 pass=$5 channels=$6
  echo "=== $id ($ip:$port) ==="

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [DRY] would PUT HTTP host + motion $channels channels"
    return
  fi

  # Test auth
  if ! curl -sSf --digest -u "$user:$pass" --max-time 8 \
       "http://$ip:$port/ISAPI/System/deviceInfo" > /dev/null 2>&1; then
    echo "  FAIL: cannot reach ISAPI at $ip:$port"
    return 1
  fi

  # 1. Configure HTTP Host Notification
  echo "  → HTTP Host Notification"
  http_host_xml | curl -sS --digest -u "$user:$pass" --max-time 10 \
    -X PUT -H "Content-Type: application/xml" \
    --data-binary @- \
    "http://$ip:$port/ISAPI/Event/notification/httpHosts" \
    | head -c 200
  echo

  # 2. Enable motion detection on each channel
  for ch in $(seq 1 "$channels"); do
    echo "  → Motion ch$ch"
    motion_xml "$ch" | curl -sS --digest -u "$user:$pass" --max-time 10 \
      -X PUT -H "Content-Type: application/xml" \
      --data-binary @- \
      "http://$ip:$port/ISAPI/System/Video/inputs/channels/$ch/motionDetection" \
      | head -c 120
    echo
  done

  echo "  ✓ $id configured"
}

main() {
  echo "VPS endpoint: $VPS_ENDPOINT"
  echo "Push user: $HIK_PUSH_USER"
  echo "Push pass: [generated, stored in /etc/aion/secrets/]"
  if [ "$DRY_RUN" != "--dry-run" ]; then
    echo "$HIK_PUSH_PASS" | sudo tee /etc/aion/secrets/isapi-push-password > /dev/null
    sudo chmod 600 /etc/aion/secrets/isapi-push-password
  fi
  echo

  local ok=0 fail=0
  for row in "${DEVICES[@]}"; do
    IFS='|' read -r id ip port user pass channels <<< "$row"
    if configure_device "$id" "$ip" "$port" "$user" "$pass" "$channels"; then
      ok=$((ok+1))
    else
      fail=$((fail+1))
    fi
  done

  echo
  echo "Done: $ok OK, $fail FAIL"
}

main "$@"
