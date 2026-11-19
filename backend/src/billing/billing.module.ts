import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingService } from './billing.service';
import {
  BillingController,
  BillingEventsController,
} from './billing.controller';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingEventsController],
  providers: [BillingService],
})
export class BillingModule {}
