import source from '../database/data-source';
import { validateEnvironment } from '../config/environment';
import { deliverOne, smtpSender } from './delivery';

async function main() {
  const env = validateEnvironment(process.env);
  const send = smtpSender(process.env); // Refuse before connecting unless explicitly configured.
  try {
    await source.initialize();
    let processed = 0;
    for (; processed < 20; processed++) {
      if (
        (await deliverOne(
          source,
          env.ACCOUNT_MAIL_ENCRYPTION_KEY,
          process.env.PUBLIC_APP_URL!,
          send,
        )) === 'empty'
      )
        break;
    }
    console.log(`Processed ${processed} account mail jobs.`);
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error(
    'Account mail processing failed or is not configured. Check SMTP settings without logging secrets.',
  );
  process.exitCode = 1;
});
