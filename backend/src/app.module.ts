import { PrivacyModule } from './account/privacy.module';
import { DeviceModule } from './devices/device.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './common/health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { databaseOptions } from './database/options';
import { WorkspaceModule } from './workspaces/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60000, limit: config.get<number>('API_RATE_LIMIT', 120) },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        databaseOptions({
          NODE_ENV: config.get('NODE_ENV'),
          DATABASE_URL: config.get('DATABASE_URL'),
          DATABASE_SSL: config.get('DATABASE_SSL'),
          DATABASE_SSL_CA: config.get('DATABASE_SSL_CA'),
          DB_SYNCHRONIZE: config.get('DB_SYNCHRONIZE'),
        }),
    }),
    AuthModule,
    DeviceModule,
    PrivacyModule,
    WorkspaceModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
