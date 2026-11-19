import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspaces/workspace.module';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
