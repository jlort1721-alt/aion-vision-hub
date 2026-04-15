# VPS SCAN — 2026-04-15T20:52:15Z

## HOSTNAME / OS
 Static hostname: ip-172-31-8-215
       Icon name: computer-vm
         Chassis: vm 🖴
      Machine ID: ec20aec2a9fc70f1a767d643a594936d
         Boot ID: e5c1fcdba9354605a8667409375294b8
  Virtualization: amazon
Operating System: Ubuntu 24.04.4 LTS
          Kernel: Linux 6.17.0-1010-aws
    Architecture: x86-64
 Hardware Vendor: Amazon EC2
  Hardware Model: t3.xlarge
Firmware Version: 1.0
   Firmware Date: Mon 2017-10-16
    Firmware Age: 8y 5month 4w 1d

## UPTIME / LOAD
 20:52:15 up 16:12,  5 users,  load average: 2.18, 2.34, 2.27

## DISCO
Filesystem       Size  Used Avail Use% Mounted on
/dev/root        193G   42G  152G  22% /
tmpfs            7.8G  1.1M  7.8G   1% /dev/shm
tmpfs            3.1G  1.9M  3.1G   1% /run
tmpfs            5.0M     0  5.0M   0% /run/lock
efivarfs         128K  4.1K  119K   4% /sys/firmware/efi/efivars
/dev/nvme0n1p16  881M  162M  657M  20% /boot
/dev/nvme1n1      98G  2.0M   93G   1% /data
/dev/nvme0n1p15  105M  6.2M   99M   6% /boot/efi
tmpfs            1.6G   16K  1.6G   1% /run/user/1000

## MEMORIA
               total        used        free      shared  buff/cache   available
Mem:            15Gi       5.5Gi       1.4Gi        84Mi       8.9Gi       9.9Gi
Swap:          2.0Gi        16Ki       2.0Gi

## CPU
Architecture:                            x86_64
CPU op-mode(s):                          32-bit, 64-bit
Address sizes:                           46 bits physical, 48 bits virtual
Byte Order:                              Little Endian
CPU(s):                                  4
On-line CPU(s) list:                     0-3
Vendor ID:                               GenuineIntel
Model name:                              Intel(R) Xeon(R) Platinum 8259CL CPU @ 2.50GHz
CPU family:                              6
Model:                                   85
Thread(s) per core:                      2
Core(s) per socket:                      2

## PUERTOS ABIERTOS
Netid State  Recv-Q Send-Q     Local Address:Port  Peer Address:PortProcess                                                                                                                                    
udp   UNCONN 0      0                0.0.0.0:3326       0.0.0.0:*    users:(("asterisk",pid=656,fd=12))                                                                                                        
udp   UNCONN 0      0                0.0.0.0:3478       0.0.0.0:*    users:(("turnserver",pid=659,fd=27))                                                                                                      
udp   UNCONN 0      0                0.0.0.0:3478       0.0.0.0:*    users:(("turnserver",pid=659,fd=26))                                                                                                      
udp   UNCONN 0      0                0.0.0.0:3478       0.0.0.0:*    users:(("turnserver",pid=659,fd=25))                                                                                                      
udp   UNCONN 0      0                0.0.0.0:3478       0.0.0.0:*    users:(("turnserver",pid=659,fd=24))                                                                                                      
udp   UNCONN 0      0                0.0.0.0:4500       0.0.0.0:*    users:(("charon",pid=736,fd=15))                                                                                                          
udp   UNCONN 0      0                0.0.0.0:4569       0.0.0.0:*    users:(("asterisk",pid=656,fd=22))                                                                                                        
udp   UNCONN 1280   0                0.0.0.0:5060       0.0.0.0:*    users:(("asterisk",pid=656,fd=14))                                                                                                        
udp   UNCONN 0      0                0.0.0.0:5353       0.0.0.0:*    users:(("openclaw-gatewa",pid=1696560,fd=33))                                                                                             
udp   UNCONN 0      0                0.0.0.0:5353       0.0.0.0:*    users:(("openclaw-gatewa",pid=1696560,fd=32))                                                                                             
udp   UNCONN 0      0                0.0.0.0:5353       0.0.0.0:*    users:(("openclaw-gatewa",pid=1696560,fd=28))                                                                                             
udp   UNCONN 0      0                0.0.0.0:5353       0.0.0.0:*    users:(("openclaw-gatewa",pid=1696560,fd=26))                                                                                             
udp   UNCONN 0      0                0.0.0.0:5353       0.0.0.0:*    users:(("openclaw-gatewa",pid=1696560,fd=24))                                                                                             
udp   UNCONN 0      0                0.0.0.0:30000      0.0.0.0:*    users:(("docker-proxy",pid=26773,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30001      0.0.0.0:*    users:(("docker-proxy",pid=26800,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30002      0.0.0.0:*    users:(("docker-proxy",pid=26826,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30003      0.0.0.0:*    users:(("docker-proxy",pid=26850,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30004      0.0.0.0:*    users:(("docker-proxy",pid=26874,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30005      0.0.0.0:*    users:(("docker-proxy",pid=26897,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30006      0.0.0.0:*    users:(("docker-proxy",pid=26920,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30007      0.0.0.0:*    users:(("docker-proxy",pid=26957,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30008      0.0.0.0:*    users:(("docker-proxy",pid=26989,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30009      0.0.0.0:*    users:(("docker-proxy",pid=27018,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30010      0.0.0.0:*    users:(("docker-proxy",pid=27041,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30011      0.0.0.0:*    users:(("docker-proxy",pid=27070,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30012      0.0.0.0:*    users:(("docker-proxy",pid=27093,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30013      0.0.0.0:*    users:(("docker-proxy",pid=27120,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30014      0.0.0.0:*    users:(("docker-proxy",pid=27142,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30015      0.0.0.0:*    users:(("docker-proxy",pid=27164,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30016      0.0.0.0:*    users:(("docker-proxy",pid=27188,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30017      0.0.0.0:*    users:(("docker-proxy",pid=27212,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30018      0.0.0.0:*    users:(("docker-proxy",pid=27240,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30019      0.0.0.0:*    users:(("docker-proxy",pid=27262,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30020      0.0.0.0:*    users:(("docker-proxy",pid=27285,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30021      0.0.0.0:*    users:(("docker-proxy",pid=27310,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30022      0.0.0.0:*    users:(("docker-proxy",pid=27377,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30023      0.0.0.0:*    users:(("docker-proxy",pid=27401,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30024      0.0.0.0:*    users:(("docker-proxy",pid=27459,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30025      0.0.0.0:*    users:(("docker-proxy",pid=27485,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30026      0.0.0.0:*    users:(("docker-proxy",pid=27512,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30027      0.0.0.0:*    users:(("docker-proxy",pid=27546,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30028      0.0.0.0:*    users:(("docker-proxy",pid=27576,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30029      0.0.0.0:*    users:(("docker-proxy",pid=27600,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30030      0.0.0.0:*    users:(("docker-proxy",pid=27629,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30031      0.0.0.0:*    users:(("docker-proxy",pid=27657,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30032      0.0.0.0:*    users:(("docker-proxy",pid=27717,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30033      0.0.0.0:*    users:(("docker-proxy",pid=27742,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30034      0.0.0.0:*    users:(("docker-proxy",pid=27765,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30035      0.0.0.0:*    users:(("docker-proxy",pid=27790,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30036      0.0.0.0:*    users:(("docker-proxy",pid=27815,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30037      0.0.0.0:*    users:(("docker-proxy",pid=27840,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30038      0.0.0.0:*    users:(("docker-proxy",pid=27862,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30039      0.0.0.0:*    users:(("docker-proxy",pid=27887,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30040      0.0.0.0:*    users:(("docker-proxy",pid=27939,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30041      0.0.0.0:*    users:(("docker-proxy",pid=27971,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30042      0.0.0.0:*    users:(("docker-proxy",pid=27997,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30043      0.0.0.0:*    users:(("docker-proxy",pid=28021,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30044      0.0.0.0:*    users:(("docker-proxy",pid=28047,fd=8))                                                                                                   
udp   UNCONN 0      0                0.0.0.0:30045      0.0.0.0:*    users:(("docker-proxy",pid=28075,fd=8))                                                                                                   

## FIREWALL
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere                   # SSH
80/tcp                     ALLOW IN    Anywhere                   # HTTP
443/tcp                    ALLOW IN    Anywhere                   # HTTPS
5060/udp                   ALLOW IN    Anywhere                   # Asterisk-SIP
5061/tcp                   ALLOW IN    Anywhere                   # Asterisk-SIP-TLS
10000:20000/udp            ALLOW IN    Anywhere                   # RTP-media
3000                       DENY IN     Anywhere                  
8080/tcp                   DENY IN     Anywhere                   # Block Asterisk HTTP direct
8088/tcp                   DENY IN     Anywhere                   # Block Asterisk HTTP direct
8089/tcp                   ALLOW IN    Anywhere                   # Asterisk-WSS
8554/tcp                   ALLOW IN    Anywhere                   # go2rtc-RTSP
8555/tcp                   ALLOW IN    Anywhere                   # go2rtc WebRTC TCP fallback
8555/udp                   ALLOW IN    Anywhere                   # go2rtc WebRTC media
3001/tcp                   DENY IN     Anywhere                   # Block-direct-API
5050/tcp                   DENY IN     Anywhere                   # Block-direct-FR
1984/tcp                   DENY IN     Anywhere                   # Block-direct-go2rtc
3478/udp                   ALLOW IN    Anywhere                   # coturn STUN/TURN
3478/tcp                   ALLOW IN    Anywhere                   # coturn TURN TCP
49152:49252/udp            ALLOW IN    Anywhere                   # coturn relay ports
7660/tcp                   ALLOW IN    Anywhere                   # Hikvision ISUP/EHome
7681/tcp                   ALLOW IN    Anywhere                   # Dahua Platform Access
15060/udp                  ALLOW IN    Anywhere                   # aion-vh-sip-gb28181
15060/tcp                  ALLOW IN    Anywhere                   # aion-vh-sip-gb28181-tcp

## PROCESOS TOP MEM
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
openclaw 1696560  0.4  2.5 12096612 412868 ?     Sl   08:44   3:05 openclaw-gateway
ubuntu    681868  0.8  2.4 23146428 399916 ?     Ssl  06:07   7:30 node /usr/bin/n8n
openclaw 1170471 99.0  2.2 11865732 360868 ?     Rl   07:23 800:55 openclaw-onboard
ubuntu   1772731  2.2  1.6 22964964 272580 ?     Ssl  08:56  16:26 node /var/www/aionseg/backend/apps/backend-api/dist/index.
472        26365  0.1  0.9 1538472 154752 ?      Ssl  04:40   1:28 grafana server --homepath=/usr/share/grafana --config=/etc/grafana/grafana.ini --packaging=docker cfg:default.log.mode=console cfg:default.paths.data=/var/lib/grafana cfg:default.paths.logs=/var/log/grafana cfg:default.paths.plugins=/var/lib/grafana/plugins cfg:default.paths.provisioning=/etc/grafana/provisioning
root        1027  0.7  0.8 11916888 132216 ?     Ssl  04:40   7:03 /usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock
nobody     26316  0.7  0.7 1758060 126520 ?      Ssl  04:40   7:34 /bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --storage.tsdb.retention.time=30d --storage.tsdb.retention.size=10GB --web.enable-lifecycle --web.external-url=https://metrics.aionseg.co
ubuntu    183852  1.3  0.6 11806548 109952 ?     Ssl  04:56  13:09 node /var/www/aionseg/backend/apps/backend-api/dist/worker
ubuntu    682325  0.1  0.6 22015448 109612 ?     Sl   06:07   1:01 node --disallow-code-generation-from-strings --disable-proto=delete /usr/lib/node_modules/n8n/node_modules/@n8n/task-runner/dist/start.js
ubuntu    184050  0.2  0.6 54341576 104476 ?     Sl   04:56   2:12 /usr/bin/node --require /opt/aion/vision-hub/orchestrator/node_modules/tsx/dist/preflight.cjs --import file:///opt/aion/vision-hub/orchestrator/node_modules/tsx/dist/loader.mjs src/main.ts
ubuntu    183802  0.2  0.5 11804588 92948 ?      Ssl  04:56   2:49 node /var/www/aionseg/backend/apps/backend-api/dist/worker
asterisk     656  3.2  0.5 2287388 90568 ?       Ssl  04:40  31:32 /usr/sbin/asterisk -g -f -p -U asterisk
ubuntu    183825  0.2  0.5 11791012 82464 ?      Ssl  04:56   2:32 node /var/www/aionseg/backend/apps/backend-api/dist/worker
root         665  0.2  0.4 1281584 79868 ?       Ssl  04:40   2:43 /usr/bin/python3 /usr/bin/fail2ban-server -xf start

## SERVICIOS AION
  aion-owl.service                               loaded active running AION Vision Hub · OWL SIP Gateway (GB28181)
  asterisk.service                               loaded active running Asterisk PBX
  go2rtc.service                                 loaded active running go2rtc video streaming server
  mediamtx.service                               loaded active running MediaMTX RTSP relay
  nginx.service                                  loaded active running A high performance web server and a reverse proxy server
  postgresql@16-main.service                     loaded active running PostgreSQL Cluster 16-main
  redis-server.service                           loaded active running Advanced key-value store

## DOCKER CONTAINERS
NAMES               STATUS        PORTS
aion-exporter       Up 16 hours   127.0.0.1:9210->9210/tcp
prometheus          Up 16 hours   127.0.0.1:9090->9090/tcp
postgres-exporter   Up 16 hours   
pm2-exporter        Up 16 hours   127.0.0.1:9209->9209/tcp
blackbox            Up 16 hours   127.0.0.1:9115->9115/tcp
grafana             Up 16 hours   127.0.0.1:3009->3000/tcp
nginx-exporter      Up 16 hours   127.0.0.1:9113->9113/tcp
alertmanager        Up 15 hours   127.0.0.1:9093->9093/tcp
node-exporter       Up 16 hours   127.0.0.1:9100->9100/tcp
aion-zlm            Up 16 hours   0.0.0.0:9550->9550/tcp, [::]:9550->9550/tcp, 0.0.0.0:10554->10554/tcp, [::]:10554->10554/tcp, 0.0.0.0:30000-30500->30000-30500/udp, [::]:30000-30500->30000-30500/udp

## PM2 LIST
pm2-logrotate                  online     restarts=  0 mem=73MB cpu=0.3%
snap-ss-dvr                    online     restarts=  0 mem=3MB cpu=0%
snap-ag-dvr1                   online     restarts=  0 mem=3MB cpu=0.1%
snap-ag-dvr                    online     restarts=  0 mem=3MB cpu=0%
snap-pq-nvr                    online     restarts=  0 mem=3MB cpu=0.2%
snap-pq-dvr                    online     restarts=  0 mem=3MB cpu=0%
snap-tl-dvr                    online     restarts=  0 mem=3MB cpu=0%
snap-tl-nvr                    online     restarts=  0 mem=3MB cpu=0%
snap-br-lpr1                   online     restarts=  0 mem=3MB cpu=0%
snap-br-lpr2                   online     restarts=  0 mem=3MB cpu=0%
snap-se-dvr1                   online     restarts=  0 mem=3MB cpu=0%
snap-ar-dvr                    online     restarts=  0 mem=3MB cpu=0%
face-recognition               online     restarts=  0 mem=19MB cpu=0.1%
snap-rtsp                      online     restarts=  0 mem=3MB cpu=0.2%
n8n-automations                online     restarts=  0 mem=390MB cpu=0.5%
snap-dahua                     online     restarts=  0 mem=22MB cpu=0%
platform-server                online     restarts=  0 mem=20MB cpu=0.3%
detection-worker               online     restarts=  0 mem=90MB cpu=0.3%
isapi-alerts                   online     restarts=  0 mem=63MB cpu=0.2%
aionseg-api                    online     restarts=  0 mem=266MB cpu=1.5%
hik-monitor                    online     restarts=  0 mem=79MB cpu=0.3%
aion-vh-bridge                 online     restarts=  0 mem=60MB cpu=0%
aion-vh-orchestrator           online     restarts=  0 mem=60MB cpu=0%
hik-heartbeat-bridge           online     restarts=  0 mem=3MB cpu=0%
native-device-bridge           online     restarts=  0 mem=106MB cpu=4.2%

## DOCKER COMPOSE STACKS
/opt/aion/observability/docker-compose.yml
/root/aion-backup-20260405-171244/backend/docker-compose.prod.yml
/root/aion-backup-20260405-171244/backend/docker-compose.monitoring.yml
/root/aion-backup-20260405-171244/backend/docker-compose.yml

## NGINX SITES
aionseg.co
clave
stream.aionseg.co
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

## SSL CERTS
  Certificate Name: aionseg.co
    Domains: aionseg.co www.aionseg.co
    Expiry Date: 2026-07-01 02:36:26+00:00 (VALID: 76 days)
    Certificate Path: /etc/letsencrypt/live/aionseg.co/fullchain.pem
  Certificate Name: stream.aionseg.co
    Domains: stream.aionseg.co
    Expiry Date: 2026-07-02 08:39:21+00:00 (VALID: 77 days)
    Certificate Path: /etc/letsencrypt/live/stream.aionseg.co/fullchain.pem

## CRON
certbot
e2scrub_all
imou-refresh
sysstat

## LOGS ERRORES 24h
Apr 15 02:56:38 ip-172-31-8-215 networkctl[2266756]: Interface "veth2282401" not found.
Apr 15 02:59:56 ip-172-31-8-215 networkctl[2298649]: Interface "veth24af1ec" not found.
Apr 15 02:59:56 ip-172-31-8-215 networkctl[2298652]: Interface "veth9599a97" not found.
Apr 15 02:59:56 ip-172-31-8-215 networkctl[2298668]: Interface "vethd7c4b8f" not found.
Apr 15 02:59:56 ip-172-31-8-215 networkctl[2298722]: Interface "veth746c679" not found.
Apr 15 02:59:56 ip-172-31-8-215 networkctl[2298733]: Interface "vethd60225e" not found.
Apr 15 03:01:58 ip-172-31-8-215 networkctl[2315097]: Interface "veth59226ca" not found.
Apr 15 03:01:58 ip-172-31-8-215 networkctl[2315103]: Interface "veth925a457" not found.
Apr 15 03:05:37 ip-172-31-8-215 networkctl[2352688]: Interface "veth483103a" not found.
Apr 15 03:05:37 ip-172-31-8-215 networkctl[2352712]: Interface "vethf3a4e81" not found.
Apr 15 03:05:37 ip-172-31-8-215 networkctl[2352719]: Interface "veth7188d9f" not found.
Apr 15 03:07:00 ip-172-31-8-215 networkctl[2366071]: Interface "vethfb80b39" not found.
Apr 15 03:07:00 ip-172-31-8-215 networkctl[2366089]: Interface "veth4c33c92" not found.
Apr 15 03:10:04 ip-172-31-8-215 networkctl[2396497]: Interface "veth480fffe" not found.
Apr 15 03:10:04 ip-172-31-8-215 networkctl[2396501]: Interface "veth27ab082" not found.
Apr 15 03:10:04 ip-172-31-8-215 networkctl[2396517]: Interface "veth764705e" not found.
Apr 15 03:11:25 ip-172-31-8-215 networkctl[2410098]: Interface "vethdb07774" not found.
Apr 15 03:11:25 ip-172-31-8-215 networkctl[2410102]: Interface "veth91c3ae4" not found.
Apr 15 03:11:25 ip-172-31-8-215 networkctl[2410155]: Interface "veth6e20256" not found.
Apr 15 04:27:44 ip-172-31-8-215 xl2tpd[754]: death_handler: Fatal signal 15 received
-- Boot 273a9886e316429a81616790359d1805 --
Apr 15 04:28:14 ip-172-31-8-215 asterisk[654]: radcli: rc_read_config: rc_read_config: can't open /etc/radiusclient-ng/radiusclient.conf: No such file or directory
Apr 15 04:28:14 ip-172-31-8-215 asterisk[654]: radcli: rc_read_config: rc_read_config: can't open /etc/radiusclient-ng/radiusclient.conf: No such file or directory
Apr 15 04:39:35 ip-172-31-8-215 xl2tpd[797]: death_handler: Fatal signal 15 received
-- Boot e5c1fcdba9354605a8667409375294b8 --
Apr 15 04:40:03 ip-172-31-8-215 asterisk[656]: radcli: rc_read_config: rc_read_config: can't open /etc/radiusclient-ng/radiusclient.conf: No such file or directory
Apr 15 04:40:03 ip-172-31-8-215 asterisk[656]: radcli: rc_read_config: rc_read_config: can't open /etc/radiusclient-ng/radiusclient.conf: No such file or directory
Apr 15 06:18:23 ip-172-31-8-215 networkctl[749943]: Interface "veth27a7b10" not found.
Apr 15 07:14:43 ip-172-31-8-215 sudo[1106341]: openclaw : command not allowed ; PWD=/home/openclaw ; USER=root ; COMMAND=validate
Apr 15 20:07:02 ip-172-31-8-215 sshd[1865949]: error: kex_exchange_identification: read: Connection reset by peer

## POSTGRES
                                                                 version                                                                  
------------------------------------------------------------------------------------------------------------------------------------------
 PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit
(1 row)

                                                     List of databases
     Name     |  Owner   | Encoding | Locale Provider | Collate |  Ctype  | Locale | ICU Rules |     Access privileges      
--------------+----------+----------+-----------------+---------+---------+--------+-----------+----------------------------
 aionseg_prod | postgres | UTF8     | libc            | C.UTF-8 | C.UTF-8 |        |           | =Tc/postgres              +
              |          |          |                 |         |         |        |           | postgres=CTc/postgres     +
              |          |          |                 |         |         |        |           | aionseg=CTc/postgres      +
              |          |          |                 |         |         |        |           | openclaw_reader=c/postgres
 postgres     | postgres | UTF8     | libc            | C.UTF-8 | C.UTF-8 |        |           | 
 template0    | postgres | UTF8     | libc            | C.UTF-8 | C.UTF-8 |        |           | =c/postgres               +
              |          |          |                 |         |         |        |           | postgres=CTc/postgres
 template1    | postgres | UTF8     | libc            | C.UTF-8 | C.UTF-8 |        |           | =c/postgres               +
              |          |          |                 |         |         |        |           | postgres=CTc/postgres
(4 rows)

 conexiones 
------------
         28
(1 row)


## GO2RTC
streams=128

## HCNET BRIDGE

## n8n
{"status":"ok"}
## ASTERISK
Asterisk 20.6.0~dfsg+~cs6.13.40431414-2build5 built by nobody @ buildd.debian.org on a unknown running Linux on 2024-04-15 00:13:12 UTC
42

## ERRORES NGINX (últimos 30)
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-hospital-ch10&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-hospital-ch10&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-hospital-ch1&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-hospital-ch1&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-hospital-ch0&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-hospital-ch0&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch7&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch7&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch6&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch6&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch5&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch5&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch4&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch4&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch3&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch3&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch2&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch2&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-danubios-ch1&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-danubios-ch1&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-terrabamba-ch10&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-terrabamba-ch10&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch9&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch9&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch8&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch8&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch7&t=1776267780815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch7&t=1776267780815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch7&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch7&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch6&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch6&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:11 [error] 1773374#1773374: *212067 upstream prematurely closed connection while reading response header from upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch5&t=1776267790815 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch5&t=1776267790815", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-alborada-ch4&t=1776267791981 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-alborada-ch4&t=1776267791981", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-alborada-ch5&t=1776267791981 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-alborada-ch5&t=1776267791981", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-alborada-ch7&t=1776267791981 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-alborada-ch7&t=1776267791981", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch14&t=1776267791981 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch14&t=1776267791981", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch11&t=1776267791982 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch11&t=1776267791982", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch0&t=1776267791982 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch0&t=1776267791982", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-alborada-ch9&t=1776267791982 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-alborada-ch9&t=1776267791982", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch16&t=1776267791982 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch16&t=1776267791982", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch15&t=1776267791983 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch15&t=1776267791983", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-alborada-ch8&t=1776267791983 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-alborada-ch8&t=1776267791983", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch1&t=1776267791983 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch1&t=1776267791983", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch10&t=1776267791984 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch10&t=1776267791984", host: "aionseg.co", referrer: "https://aionseg.co/live-view"
2026/04/15 15:43:12 [error] 1773374#1773374: *212067 connect() failed (111: Connection refused) while connecting to upstream, client: 191.95.144.94, server: aionseg.co, request: "GET /go2rtc/api/frame.jpeg?src=da-brescia-ch13&t=1776267792407 HTTP/2.0", upstream: "http://127.0.0.1:1984/api/frame.jpeg?src=da-brescia-ch13&t=1776267792407", host: "aionseg.co", referrer: "https://aionseg.co/live-view"

## DIRECTORIOS AION
total 52
drwxr-xr-x  6 root   root   4096 Apr 13 02:55 .
drwxr-xr-x 25 root   root   4096 Apr 15 04:40 ..
drwxr-xr-x 15 ubuntu ubuntu 4096 Apr 15 07:14 aion
drwx--x--x  4 root   root   4096 Apr 13 02:55 containerd
drwxr-xr-x  6 root   root   4096 Apr  2 11:36 dh-p2p
drwxr-xr-x  4 root   root   4096 Apr  2 08:04 hikvision-sdk
-rw-r--r--  1 root   root   4385 Mar 31 07:19 imou_refresh.py
-rwxr-xr-x  1 root   root   3903 Apr  2 04:05 imou_refresh_v2.py
-rwxr-xr-x  1 root   root   5757 Apr  2 07:31 imou_refresh_v3.py
-rwxr-xr-x  1 root   root   5370 Apr  2 08:00 imou_rtmp_refresh.py
total 3964
drwxr-xr-x 15 ubuntu ubuntu    4096 Apr 15 07:14 .
drwxr-xr-x  6 root   root      4096 Apr 13 02:55 ..
-rw-------  1 ubuntu ubuntu     687 Apr 15 00:46 .env.qa
-rw-rw-r--  1 ubuntu ubuntu 3982836 Apr 15 06:00 AION-ENTREGA-2026-04-15.zip
drwxrwxr-x  2 ubuntu ubuntu    4096 Apr 15 05:33 audit
drwxr-xr-x  3 root   root      4096 Apr 15 07:14 backups
drwxr-xr-x  5 ubuntu ubuntu    4096 Apr 15 00:41 db
drwxrwxr-x  2 ubuntu ubuntu    4096 Apr 15 15:33 docs
-rw-rw-r--  1 ubuntu ubuntu    8041 Apr 15 01:30 ecosystem.extra.config.js
drwxr-xr-x  7 ubuntu ubuntu    4096 Apr 15 06:18 observability
drwx------  8 ubuntu ubuntu    4096 Apr 14 16:53 ops
drwxr-xr-x  5 ubuntu ubuntu    4096 Apr 15 14:38 qa
drwxr-xr-x  3 ubuntu ubuntu    4096 Apr 15 00:41 runbooks
drwxr-xr-x  3 ubuntu ubuntu    4096 Apr 15 05:33 scripts
drwxr-xr-x  3 ubuntu ubuntu    4096 Apr 14 06:35 services
drwxr-xr-x  2 ubuntu ubuntu    4096 Apr 15 05:34 snapshots
drwxr-xr-x  2 ubuntu ubuntu    4096 Apr 15 00:41 validation
drwxr-xr-x 19 ubuntu ubuntu    4096 Apr 13 17:34 vision-hub
total 228
drwxr-x--- 17 ubuntu ubuntu   4096 Apr 13 03:03 .
drwxr-xr-x  5 root   root     4096 Apr 15 07:06 ..
-rw-------  1 ubuntu ubuntu    510 Apr 15 12:17 .bash_history
-rw-r--r--  1 ubuntu ubuntu    220 Mar 31  2024 .bash_logout
-rw-r--r--  1 ubuntu ubuntu   3834 Apr  2 11:39 .bashrc
drwx------  8 ubuntu ubuntu   4096 Apr 15 03:16 .cache
drwxrwxr-x  4 ubuntu ubuntu   4096 Apr  2 11:40 .cargo
drwx------  5 ubuntu ubuntu   4096 Apr 10 02:51 .config
drwxrwxr-x  8 ubuntu ubuntu   4096 Mar 30 03:37 .local
drwxrwxr-x  4 ubuntu ubuntu   4096 Apr 15 06:07 .n8n
drwxrwxr-x  5 ubuntu ubuntu   4096 Apr  6 00:55 .npm
drwxrwxr-x  5 ubuntu ubuntu   4096 Apr 15 04:56 .pm2
-rw-r--r--  1 ubuntu ubuntu    828 Apr  2 11:39 .profile
drwxrwxr-x  6 ubuntu ubuntu   4096 Apr  2 11:39 .rustup
drwx------  2 ubuntu ubuntu   4096 Apr  2 05:28 .ssh
-rw-r--r--  1 ubuntu ubuntu      0 Mar 27 09:22 .sudo_as_admin_successful
-rw-rw-r--  1 ubuntu ubuntu    239 Apr 12 13:18 .wget-hsts
-rw-rw-r--  1 ubuntu ubuntu 142671 Apr  8 00:12 backup_pre_deploy_20260407_1912.sql.gz
drwxr-xr-x 11 ubuntu ubuntu   4096 Apr  8 00:12 dist_backup_20260407_1912
