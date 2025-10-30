import { Test } from '@nestjs/testing';
import { SMSHelper } from './sms.helper';
import { Msg91Helper } from './msg91';
import { AxiosHelper } from '../axiosCall/axios.helper';
import { SecretsService } from '../secretsService/secrets.service';

describe('Test Cases for SMSHelper', () => {
  let instance: SMSHelper;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SMSHelper,
        {
          provide: AxiosHelper,
          useValue: {
            getData: () => null,
            postData: () => null,
          },
        },
        {
          provide: SecretsService,
          useValue: {
            getSecret: () => 'abcd',
          },
        },
        {
          provide: Msg91Helper,
          useValue: {
            sendSMS: () => null,
          },
        },
      ],
    }).compile();
    instance = module.get<SMSHelper>(SMSHelper);
  });
  it('All Functions should be defined', () => {
    expect(instance.sendSms).toBeDefined();
  });

  it('sendSms null response', async () => {
    const res = await instance.sendSms({ mobNo: '1' });
    expect(res).toBe(undefined);
  });

  it('sendSms correct response', async () => {
    const checkWhatsappEnable = jest.spyOn(
      (instance as any).msg91Helper,
      'sendSMS',
    );
    checkWhatsappEnable.mockImplementationOnce(() => {
      return {
        headers: {
          authkey: 'authKey',
          'content-type': 'application/json',
        },
      };
    });


    const res = await instance.sendSms({ mobNo: '1' });
    expect(res).toBe(undefined);
  });
});
