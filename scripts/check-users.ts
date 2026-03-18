import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../backend/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) dbUrl = line.substring(13).trim();
}

const sql = postgres(dbUrl, { max: 2 });

async function main() {
  // Check profiles
  const profiles = await sql`
    SELECT p.user_id, p.full_name, p.is_active, p.tenant_id, r.role
    FROM public.profiles p
    LEFT JOIN public.user_roles r ON r.user_id = p.user_id
    ORDER BY p.created_at`;

  console.log('═══ Profiles in DB ═══');
  if (profiles.length === 0) {
    console.log('  (no profiles found)');
  }
  for (const p of profiles) {
    console.log(`  userId=${p.user_id} | name=${p.full_name} | role=${p.role || 'none'} | active=${p.is_active}`);
  }

  // Try auth.users
  try {
    const authUsers = await sql`SELECT id, email, created_at FROM auth.users ORDER BY created_at`;
    console.log('\n═══ Supabase Auth Users ═══');
    for (const u of authUsers) {
      console.log(`  id=${u.id} | email=${u.email}`);
    }
  } catch {
    console.log('\n(Cannot query auth.users via pooler — need to check Supabase Dashboard)');
  }

  // Check Supabase config
  const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim() || '';
  const supabaseKey = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim() || '';

  console.log('\n═══ Auth Configuration ═══');
  console.log(`  Supabase URL: ${supabaseUrl || '(check root .env)'}`);
  console.log(`  Auth type: Supabase Auth (email/password)`);
  console.log(`  Login endpoint: POST http://localhost:3000/auth/login`);

  await sql.end();
}

main();
