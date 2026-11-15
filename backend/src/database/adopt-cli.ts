import source from './data-source';
import { adoptBaseline } from './adopt-baseline';

async function main() {
  try {
    await source.initialize();
    await adoptBaseline(source);
    console.log(
      'Verified the existing schema and recorded the initial migration without changing application data.',
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error(
    'Baseline adoption refused or failed. Back up the database and run db:check; application tables were not modified by this command.',
  );
  process.exitCode = 1;
});
