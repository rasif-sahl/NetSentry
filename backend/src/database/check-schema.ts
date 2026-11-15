import dataSource from './data-source';

async function main() {
  try {
    await dataSource.initialize();
    const pending = await dataSource.driver.createSchemaBuilder().log();
    if (pending.upQueries.length) {
      console.error(
        `Schema differs from entity metadata (${pending.upQueries.length} proposed changes). No changes were applied.`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        'Database schema matches the current entity metadata. No changes were applied.',
      );
    }
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
main().catch(() => {
  console.error(
    'Schema verification failed. Check database access and configuration; connection details are not logged.',
  );
  process.exitCode = 1;
});
