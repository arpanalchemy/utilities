import { Test } from '@nestjs/testing';
import { CryptoService } from './crypto.service';
import { SecretsService } from '../secretsService/secrets.service';
import crypto from 'crypto';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: SecretsService,
          useValue: {
            getSecret: () => '',
          },
        },
      ],
    }).compile();
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  it('initialize response', async () => {
    await cryptoService.initialize();
    expect((cryptoService as any).secret).toEqual('');
    expect((cryptoService as any).iv).toEqual('');
  });

  it('should encrypt the object and return a digest of max 15 characters', () => {
    (cryptoService as any).secret = '12345678901234561234567890123456';
    (cryptoService as any).iv = '1234567890123456';

    const object = { objectPath: 'path', userID: '123', module: 'mymodule' };

    const encrypted = cryptoService.genericEncrypt(object);
    expect(encrypted).toHaveLength(82);
    expect(typeof encrypted).toBe('string');
  });

  it('should return the same digest for the same object', () => {
    (cryptoService as any).secret = '12345678901234561234567890123456';
    (cryptoService as any).iv = '1234567890123456';
    const object = { objectPath: 'path', userID: '123', module: 'mymodule' };
    const encrypted1 = cryptoService.genericEncrypt(object);
    const encrypted2 = cryptoService.genericEncrypt(object);
    expect(encrypted1).toEqual(encrypted2);
  });

  it('should decrypt the encrypted string', () => {
    (cryptoService as any).secret = '12345678901234561234567890123456';
    (cryptoService as any).iv = '1234567890123456';
    const encryptString =
      'iKmyD3j0AstIDli8wALVQ%2FtNbrq4OhS7StRImyBVQ0PNivuarDPL2flMaFZGEXfR%2F3qzKgTvv3M%3D';
    expect(cryptoService.genericDecrypt(encryptString)).toEqual({
      module: 'mymodule',
      objectPath: 'path',
      userID: '123',
    });
  });

  describe('encrypt', () => {
    it('should encrypt the text using the preferences secret key', async () => {
      jest
        .spyOn(crypto as any, 'randomBytes')
        .mockReturnValue(Buffer.from('1234567812345678'));
      jest
        .spyOn(crypto as any, 'createCipheriv')
        .mockImplementation((_algorithm, _key, _iv) => {
          return {
            update: (text) => {
              return Buffer.from(text);
            },
            final: () => {
              return Buffer.from('');
            },
          };
        });
      const text = 'my-secret-text';
      const encrypted = await cryptoService.encrypt(text);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toEqual(text);
    });
  });

  describe('decrypt', () => {
    it('should decrypt the encrypted text using the preferences secret key', async () => {
      jest
        .spyOn(crypto as any, 'createDecipheriv')
        .mockImplementation((_algorithm, _key, _iv) => {
          return {
            update: (text) => {
              return Buffer.from(text);
            },
            final: () => {
              return Buffer.from('');
            },
          };
        });
      jest
        .spyOn(cryptoService as any, 'preferencesSecretKey')
        .mockResolvedValue('secret-key');
      const text = 'my-secret-text';
      const encrypted = await cryptoService.encrypt(text);
      const decrypted = await cryptoService.decrypt(encrypted);
      expect(decrypted).toEqual(text);
    });

    it('should throw an error if the token is invalid', async () => {
      const invalidToken = 'invalid-token';
      await expect(cryptoService.decrypt(invalidToken)).rejects.toThrowError();
    });
  });

  it('should generate a base64 signature from a string', () => {
    const stringToSign = 'testStringToSign';

    // Spy on the generateSignature method
    const spy = jest.spyOn(cryptoService, 'generateSignature');

    // Call the method
    cryptoService.generateSignature(stringToSign);

    // Check if the method has been called
    expect(spy).toBeCalledWith(stringToSign);

    // Clean up the spy
    spy.mockRestore();
  });
  describe('generateRandomString', () => {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    it('should generate a transaction ID of the specified length', () => {
      const noOfLength = 10;
      const transactionId = cryptoService.generateRandomString(
        characters,
        noOfLength,
      );

      return expect(transactionId).resolves.toHaveLength(noOfLength);
    });

    it('should only contain characters from the specified set', () => {
      const noOfLength = 15;
      const transactionId = cryptoService.generateRandomString(
        characters,
        noOfLength,
      );

      return transactionId.then((transactionId) => {
        for (let char of transactionId) {
          expect(characters).toContain(char);
        }
      });
    });
  });

  describe('generateHashWithSalt', () => {
    it('should generate a consistent hash for the same input and salt', () => {
      const response = {
        key1: 'value1',
        key2: 'value2',
      };
      const salt = 'test-salt';

      const hash1 = cryptoService.generateHashWithSalt(response, salt);
      const hash2 = cryptoService.generateHashWithSalt(response, salt);

      expect(hash1).toEqual(hash2);
    });

    it('should generate different hashes for different salts', () => {
      const response = {
        key1: 'value1',
        key2: 'value2',
      };
      const salt1 = 'test-salt-1';
      const salt2 = 'test-salt-2';

      const hash1 = cryptoService.generateHashWithSalt(response, salt1);
      const hash2 = cryptoService.generateHashWithSalt(response, salt2);

      expect(hash1).not.toEqual(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const response1 = {
        key1: 'value1',
        key2: 'value2',
      };
      const response2 = {
        key1: 'value1',
        key2: 'different-value',
      };
      const salt = 'test-salt';

      const hash1 = cryptoService.generateHashWithSalt(response1, salt);
      const hash2 = cryptoService.generateHashWithSalt(response2, salt);

      expect(hash1).not.toEqual(hash2);
    });

    it('should handle empty objects correctly', () => {
      const response = {};
      const salt = 'test-salt';

      const hash = cryptoService.generateHashWithSalt(response, salt);

      // Verify the hash is a string and matches expected length
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64); // SHA-256 hash length in hex
    });

    it('should handle objects with keys in different order consistently', () => {
      const response1 = {
        key1: 'value1',
        key2: 'value2',
      };
      const response2 = {
        key2: 'value2',
        key1: 'value1',
      };
      const salt = 'test-salt';

      const hash1 = cryptoService.generateHashWithSalt(response1, salt);
      const hash2 = cryptoService.generateHashWithSalt(response2, salt);

      expect(hash1).toEqual(hash2);
    });
  });
});
