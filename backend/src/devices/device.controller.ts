import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/other/auth.guard';
import { CurrentUser } from '../auth/other/current-user.decorator';
import type { RequestUser } from '../auth/other/request-user';
import { DeviceGuard, type DeviceRequest } from './other/device.guard';
import { DeviceService } from './device.service';
import {
  ConsentDto,
  DeviceHealthDto,
  EnrolmentRequestDto,
  RedeemEnrolmentDto,
  RenameDeviceDto,
} from './other/dto/device.dto';
import { disclosureHash, disclosures } from './other/disclosures';

@Controller({ path: 'privacy', version: '1' })
export class DisclosureController {
  @Get('disclosures')
  disclosures() {
    return Object.fromEntries(
      Object.entries(disclosures).map(([key, value]) => [
        key,
        { ...value, hash: disclosureHash(key as keyof typeof disclosures) },
      ]),
    );
  }
}

@Controller({ path: 'devices', version: '1' })
export class DeviceController {
  constructor(private readonly devices: DeviceService) {}
  @Post('enrolments')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  issue(@CurrentUser() user: RequestUser, @Body() input: EnrolmentRequestDto) {
    return this.devices.issue(user.userId, input);
  }
  @Post('enrol')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  enrol(@CurrentUser() user: RequestUser, @Body() input: RedeemEnrolmentDto) {
    return this.devices.enrol(user.userId, input);
  }
  @Get(':deviceId')
  @UseGuards(AuthGuard)
  read(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.read(user.userId, id);
  }
  @Patch(':deviceId')
  @UseGuards(AuthGuard)
  rename(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
    @Body() input: RenameDeviceDto,
  ) {
    return this.devices.rename(user.userId, id, input.name);
  }
  @Get(':deviceId/history')
  @UseGuards(AuthGuard)
  history(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.history(user.userId, id);
  }
  @Post(':deviceId/consent')
  @UseGuards(AuthGuard)
  consent(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
    @Body() input: ConsentDto,
  ) {
    return this.devices.consent(user.userId, id, input);
  }
  @Delete(':deviceId/consent')
  @UseGuards(AuthGuard)
  revokeConsent(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.change(user.userId, id, 'revoke_consent');
  }
  @Post(':deviceId/pause')
  @UseGuards(AuthGuard)
  pause(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.change(user.userId, id, 'pause');
  }
  @Post(':deviceId/unenrol')
  @UseGuards(AuthGuard)
  unenrol(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.change(user.userId, id, 'unenrol');
  }
  @Delete(':deviceId')
  @UseGuards(AuthGuard)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.change(user.userId, id, 'remove');
  }
  @Delete(':deviceId/data')
  @UseGuards(AuthGuard)
  erase(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.devices.change(user.userId, id, 'delete_data');
  }
  @Get(':deviceId/configuration')
  @UseGuards(DeviceGuard)
  configuration(@Req() request: DeviceRequest) {
    return this.devices.configuration(request.monitoringDevice);
  }
  @Post(':deviceId/heartbeat')
  @UseGuards(DeviceGuard)
  heartbeat(@Req() request: DeviceRequest, @Body() input: DeviceHealthDto) {
    return this.devices.heartbeat(request.monitoringDevice, input);
  }
}
