import { Inject, Injectable } from '@nestjs/common';
import { AxiosHelper } from '../axiosCall/axios.helper';
import { SecretsService } from '../secretsService/secrets.service';

@Injectable()
export class Msg91Helper {
  @Inject()
  private readonly axiosHelper: AxiosHelper;

  @Inject()
  private readonly secrets: SecretsService;

  private readonly msg91EmailUrl = 'https://api.msg91.com/api/v5/email/send';

  private readonly msg91V5SMSUrl = 'https://api.msg91.com/api/v5/otp';

  private async getHeaderConfig(): Promise<{
    headers: { authkey: string; 'content-type': string };
  }> {
    const authKey = await this.secrets.getSecret('msg91', 'api_key');
    return {
      headers: {
        authkey: authKey,
        'content-type': 'application/json',
      },
    };
  }

  // send Msg91 Emails
  async sendEmails(params: {
    to: string;
    templateID: string;
    variables: {};
  }): Promise<void> {
    const data = {
      to: params.to,
      from: {
        name: process.env.FROM_EMAIL_NAME,
        email: process.env.FROM_EMAIL_ID,
      },
      domain: process.env.FROM_EMAIL_DOMAIN,
      mail_type_id: 1,
      reply_to: [
        {
          name: process.env.FROM_EMAIL_NAME,
          email: process.env.FROM_EMAIL_ID,
        },
      ],
      template_id: params.templateID,
      variables: params.variables,
    };

    const config = await this.getHeaderConfig();
    return this.axiosHelper.postData(this.msg91EmailUrl, data, config);
  }

  // send Msg91 SMS
  async sendSMS<T>(
    params: {
      template_id: string;
      mobile: string | number;
      authkey: string;
    },
    body: T,
  ): Promise<void> {
    const flag = await this.secrets.getSecret(
      'feature_flags',
      'msg91_downtime',
    );
    if (flag === 'true') {
      return;
    }
    const config = await this.getHeaderConfig();

    const apiUrl =
      this.msg91V5SMSUrl + `?${new URLSearchParams(params as any).toString()}`;
    return this.axiosHelper.postData(apiUrl, body, config);
  }
}
