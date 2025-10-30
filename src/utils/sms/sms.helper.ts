import { Inject, Injectable } from '@nestjs/common';
import { Msg91Helper } from './msg91';
import { SecretsService } from '../secretsService/secrets.service';

@Injectable()
export class SMSHelper {
  @Inject()
  private readonly msg91Helper: Msg91Helper;

  @Inject()
  private readonly secretService: SecretsService;

  async sendSms(smsParams: any, isAppOtp?: boolean): Promise<void> {
    const [msg91Template, msg91AuthKey] = await Promise.all([
      this.secretService.getSecret(
        'msg91',
        isAppOtp ? 'app_template_id' : 'template_id',
      ),
      this.secretService.getSecret('msg91', 'api_key'),
    ]);

    const params = {
      template_id: msg91Template,
      mobile: smsParams.mobNo,
      authkey: msg91AuthKey,
    };
    await Promise.all([this.msg91Helper.sendSMS(params, smsParams.params)]);
  }
}
