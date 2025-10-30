import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Msg91Helper } from './msg91';
import { AxiosHelper } from '../axiosCall/axios.helper';
import { SecretsService } from '../secretsService/secrets.service';

describe('Test Cases for Msg91Helper', () => {
  let instance: Msg91Helper;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        Msg91Helper,
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
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            debug: () => null,
            error: () => null,
            info: () => null,
          },
        },
      ],
    }).compile();
    instance = module.get<Msg91Helper>(Msg91Helper);
  });
  it('All Functions should be defined', () => {
    expect(instance.sendEmails).toBeDefined();
    expect(instance.sendSMS).toBeDefined();
  });

  it('sendEmails null response', async () => {
    const res = await instance.sendEmails({
      to: '',
      templateID: '',
      variables: {},
    });
    expect(res).toBe(null);
  });

  it('sendEmails correct response', async () => {
    const checkWhatsappEnable = jest.spyOn(instance as any, 'getHeaderConfig');
    checkWhatsappEnable.mockImplementationOnce(() => {
      return {
        headers: {
          authkey: 'authKey',
          'content-type': 'application/json',
        },
      };
    });

    jest.spyOn((instance as any).axiosHelper, 'postData');

    const res = await instance.sendEmails({
      to: '',
      templateID: '',
      variables: {},
    });
    expect(res).toBe(null);
  });

  it('sendSMS null response', async () => {
    const res = await instance.sendSMS({
      template_id: 'template1',
      mobile: '919123123123',
      authkey: 'authKey',
    }, { arg1: 'arg1' });
    expect(res).toBe(null);
  });

  it('sendSMS correct response', async () => {
    const checkWhatsappEnable = jest.spyOn(instance as any, 'getHeaderConfig');
    checkWhatsappEnable.mockImplementationOnce(() => {
      return {
        headers: {
          authkey: 'authKey',
          'content-type': 'application/json',
        },
      };
    });

    jest.spyOn((instance as any).axiosHelper, 'postData');
    const res = await instance.sendSMS({
      template_id: 'template1',
      mobile: '919123123123',
      authkey: 'authKey',
    }, { arg1: 'arg1' });
    expect(res).toBe(null);
  });
});
