import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Membership } from './membership.entity';
import { RegisteredDevice } from './registered-device.entity';
import { WorkspaceController } from './workspace.controller';
import { Workspace } from './workspace.entity';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Workspace, Membership, RegisteredDevice]),
  ],
  controllers: [WorkspaceController, CollaborationController],
  providers: [WorkspaceService, WorkspaceAccessService, CollaborationService],
  exports: [WorkspaceAccessService, CollaborationService],
})
export class WorkspaceModule {}
