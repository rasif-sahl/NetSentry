import { PageQuery } from '../common/pagination';
import {
  Controller,
  Get,
  Query,
  Post,
  Param,
  Body,
  Req,
  Headers,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/other/auth.guard';
import { CurrentUser } from '../auth/other/current-user.decorator';
import type { RequestUser } from '../auth/other/request-user';
import { BillingService } from './billing.service';
import {
  PlanRequestDto,
  BillingRevisionDto,
  SandboxConfirmDto,
  BillingEventDto,
} from './dto/billing.dto';
import { verifyBillingSignature, payloadHash } from './other/signature';
@Controller({ path: 'workspaces/:workspaceId/billing', version: '1' })
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('entitlements') access(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
  ) {
    return this.billing.access(u.userId, w);
  }
  @Get() view(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query('summary') summary?: string,
  ) {
    return this.billing.overview(u.userId, w, summary === 'true');
  }
  @Get('payments/page') paymentPage(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() query: PageQuery,
  ) {
    return this.billing.paymentPage(u.userId, w, query);
  }
  @Get('requests/page') pendingRequestPage(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Query() query: PageQuery,
  ) {
    return this.billing.pendingRequestPage(u.userId, w, query);
  }
  @Post('trial') trial(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: PlanRequestDto,
  ) {
    return this.billing.trial(u.userId, w, i);
  }
  @Post('checkout') checkout(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: PlanRequestDto,
  ) {
    return this.billing.checkout(u.userId, w, i);
  }
  @Post('sandbox/confirm') confirm(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: SandboxConfirmDto,
  ) {
    return this.billing.confirm(u.userId, w, i.requestId);
  }
  @Post('cancel') cancel(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: BillingRevisionDto,
  ) {
    return this.billing.cancel(u.userId, w, i.expectedRevision);
  }
  @Post('resume') resume(
    @CurrentUser() u: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) w: string,
    @Body() i: BillingRevisionDto,
  ) {
    return this.billing.cancel(u.userId, w, i.expectedRevision, true);
  }
}
@Controller({ path: 'billing', version: '1' })
export class BillingEventsController {
  constructor(private readonly billing: BillingService) {}
  @Post('events') event(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-billing-timestamp') stamp: string,
    @Headers('x-billing-signature') signature: string,
    @Body() i: BillingEventDto,
  ) {
    verifyBillingSignature(
      req.rawBody ?? Buffer.alloc(0),
      stamp ?? '',
      signature ?? '',
      process.env.BILLING_EVENT_SECRET ?? '',
    );
    return this.billing.event(i, payloadHash(req.rawBody!));
  }
}
