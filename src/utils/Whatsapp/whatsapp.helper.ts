import { Inject, Injectable } from '@nestjs/common';

import { AxiosHelper } from '../axiosCall/axios.helper';
import { URLService } from '../urlService/url.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { WhatsappRequestDto } from './whatsapp.dto';

@Injectable()
export class WhatsappHelper {
  @Inject()
  private readonly axiosHelper: AxiosHelper;
  @Inject()
  private readonly urlService: URLService;

  @Inject(WINSTON_MODULE_PROVIDER)
  private readonly logger: Logger;

  private generateWhatsappUrl(): string {
    return this.urlService.generateURL('communication/send-whatsapp');
  }

  async sendWhatsapp(data: WhatsappRequestDto): Promise<void> {
    this.logger.info(
      `Sending ${data?.messages?.length} Whatsapp for ${data.category}-${
        data.category
      }-${data.subCategory}: ${JSON.stringify(data)}`,
    );
    return this.axiosHelper.postData(this.generateWhatsappUrl(), data);
  }
}
