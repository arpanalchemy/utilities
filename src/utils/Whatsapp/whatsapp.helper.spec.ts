import { Test } from '@nestjs/testing';
import { AxiosHelper } from '../axiosCall/axios.helper';
import { URLService } from '../urlService/url.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { WhatsappHelper } from './whatsapp.helper';

describe('Testcases for WhatsappHelper', () => {
  let module: WhatsappHelper;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WhatsappHelper,
        {
          provide: AxiosHelper,
          useValue: { postData: () => null },
        },
        {
          provide: URLService,
          useValue: { generateURL: () => '' },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
          },
        },
      ],
    }).compile();

    module = moduleRef.get<WhatsappHelper>(WhatsappHelper);
  });

  it('WhatsappHelper should worl', async () => {
    const mockRequest: any = {
      category: 'test',
      subCategory: 'testing',
      userID: 50106,
      variables: { test: 1 },
    };

    const result = await module.sendWhatsapp(mockRequest);
    expect(result).toEqual(null);
  });
});
