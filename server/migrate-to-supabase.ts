import 'dotenv/config';
import { createPgPoolConfig } from './db.ts';
import { makePoolFromUrl, migratePostgresToTarget, validateTargetUrl } from './migrate-core.ts';

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has('--verify-only') || process.env.VERIFY_ONLY === 'true';

async function main() {
  const sourceUrl = (process.env.SOURCE_DATABASE_URL || '').trim();
  const targetUrl = (process.env.TARGET_DATABASE_URL || '').trim();

  if (!sourceUrl || !targetUrl) {
    console.error(
      'Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL environment variables.\n' +
        'Set both in your terminal before running:\n' +
        '  SOURCE_DATABASE_URL="postgres://..." (Render External Database URL)\n' +
        '  TARGET_DATABASE_URL="postgresql://postgres.<ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres" (Supabase Session Pooler URL)'
    );
    process.exit(1);
  }

  const targetCheck = validateTargetUrl(targetUrl, sourceUrl);
  if (targetCheck.valid === false) {
    console.error(targetCheck.error);
    process.exit(1);
  }

  const srcInfo = createPgPoolConfig(sourceUrl);
  const tgtInfo = createPgPoolConfig(targetCheck.normalizedUrl);

  console.log(`[Migrate] Source: ${srcInfo.host}:${srcInfo.port}`);
  console.log(`[Migrate] Target: ${tgtInfo.host}:${tgtInfo.port}`);
  if (tgtInfo.isDirectSupabaseHost) {
    console.warn(
      '[Migrate] Warning: Target appears to be direct IPv6 host (db.*.supabase.co). If connection fails with ENETUNREACH, use the Supabase Session Pooler URL (*.pooler.supabase.com:5432).'
    );
  }

  const sourcePool = makePoolFromUrl(sourceUrl, 5);

  try {
    const result = await migratePostgresToTarget(sourcePool, targetCheck.normalizedUrl, { verifyOnly });

    console.log('\n[Migrate] Row Count Verification:');
    let allMatched = true;
    for (const c of result.counts) {
      if (!c.ok) allMatched = false;
      console.log(`  - ${c.table.padEnd(16)} source=${c.source}  target=${c.target}  ${c.ok ? 'OK' : 'MISMATCH'}`);
    }

    if (!allMatched) {
      console.error('\n[Migrate] Verification failed: one or more target tables have fewer rows than source.');
      process.exitCode = 1;
    } else {
      console.log('\n[Migrate] All table counts verified successfully!');
    }
  } finally {
    await sourcePool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[Migrate] Fatal error:', err?.message || err);
  process.exit(1);
});
