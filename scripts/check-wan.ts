import postgres from 'postgres';

const sql = postgres("postgresql://postgres.oeplpbfikcrcvccimjki:TestAdmin456%21@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require");

async function main() {
  const rows = await sql`
    SELECT s.name as site_name, s.slug, d.name as device_name, d.device_slug, d.type, d.ip_address, d.port, d.status,
           d.username, d.password, d.serial_number
    FROM devices d
    JOIN sites s ON d.site_id = s.id
    ORDER BY s.name, d.type, d.name
  `;

  let currentSite = "";
  for (const r of rows) {
    if (r.site_name !== currentSite) {
      currentSite = r.site_name;
      const wan = rows.find(x => x.site_name === currentSite && x.type === "network_wan");
      const wanIp = wan ? wan.ip_address : "NO WAN ENTRY";
      console.log(`\n=== ${currentSite} (${r.slug}) === WAN: ${wanIp}`);
    }
    const ip = r.ip_address || "null";
    const port = r.port || "null";
    console.log(`  ${r.type.padEnd(25)} ${(r.device_name||"").substring(0,30).padEnd(30)} IP:${String(ip).padEnd(16)} Port:${String(port).padEnd(6)} ${r.status}`);
  }

  // Summary: sites with WAN IPs
  console.log("\n\n=== WAN IP SUMMARY ===");
  const wanDevices = rows.filter(r => r.type === "network_wan");
  for (const w of wanDevices) {
    console.log(`  ${w.site_name.padEnd(40)} WAN: ${w.ip_address}`);
  }
  console.log(`\nTotal WAN entries: ${wanDevices.length}`);
  console.log(`Total sites: ${new Set(rows.map(r => r.site_name)).size}`);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
