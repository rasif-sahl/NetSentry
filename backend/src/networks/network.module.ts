import { Module } from '@nestjs/common';
import { AgentModule } from '../agents/agent.module';
import { AuthModule } from '../auth/auth.module';
import {
  AgentNetworkController,
  NetworkController,
  NetworkDisclosureController,
} from './network.controller';
import { NetworkService } from './network.service';

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [
    NetworkController,
    NetworkDisclosureController,
    AgentNetworkController,
  ],
  providers: [NetworkService],
})
export class NetworkModule {}
