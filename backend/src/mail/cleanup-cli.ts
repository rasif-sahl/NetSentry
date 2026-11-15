import source from '../database/data-source';
import { cleanupAccountMail } from './cleanup';
async function main() {
  try {
    await source.initialize();
    console.log(await cleanupAccountMail(source));
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error(
    'Account cleanup failed; database and message details are not logged.',
  );
  process.exitCode = 1;
});
