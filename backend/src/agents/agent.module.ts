import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  WorkspaceDeveloperController,
  DeveloperAgentController,
} from './developer.controller';
import { DeveloperService } from './developer.service';
import { AgentService } from './agent.service';
import { WorkspaceAgentController, AgentController } from './agent.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    WorkspaceAgentController,
    AgentController,
    WorkspaceDeveloperController,
    DeveloperAgentController,
  ],
  providers: [AgentService, DeveloperService],
  exports: [AgentService],
})
export class AgentModule {}
