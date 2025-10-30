import { ChatPostMessageArguments, WebClient } from '@slack/web-api';
import { SecretsService } from '../secretsService/secrets.service';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SlackService {
  @Inject()
  private readonly secretService: SecretsService;

  private async getSecret(): Promise<string> {
    return this.secretService.getSecret('slack', 'oauth_token');
  }

  async sendMessage(
    data: ChatPostMessageArguments,
    channelID?: string,
  ): Promise<void> {
    const token = await this.getSecret();
    const client = new WebClient(token);
    if (channelID) data.channel = channelID;
    await client.chat.postMessage(data);
  }
}
