import { MailModule } from '../mail/mail.module';
import { AccountActionsService } from './account-actions.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Membership } from '../workspaces/membership.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { Session } from './session.entity';

@Module({
  imports: [
    JwtModule.register({}),
    MailModule,
    TypeOrmModule.forFeature([User, Session, Workspace, Membership]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PasswordHasher, AccountActionsService],
  exports: [AuthGuard, JwtModule, TypeOrmModule, AuthService, PasswordHasher],
})
export class AuthModule {}
