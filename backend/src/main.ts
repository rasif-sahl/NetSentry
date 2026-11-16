import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './common/configure-http';

// Legacy timestamp columns are read in UTC; new event contracts require UTC.
process.env.TZ = 'UTC';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,{rawBody:true});
  const config = app.get(ConfigService);
  configureHttp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT', 3000));
}
void bootstrap();
