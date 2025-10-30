import { Inject, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { SecretsService } from '../secretsService/secrets.service';
@Injectable()
export class CryptoService {
  @Inject()
  private readonly secretService: SecretsService;
  private readonly algorithm = 'aes-256-ctr';
  private iv: any = crypto.randomBytes(16);
  private secret;

  async initialize() {
    [this.secret, this.iv] = await Promise.all([
      this.secretService.getSecret(
        'crypto',
        process.env.CRYPTO_ENCRYPTION_KEY || 'document_encryption_key',
      ),
      this.secretService.getSecret(
        'crypto',
        process.env.CRYPTO_ENCRYPTION_IV_KEY || 'document_iv_key',
      ),
    ]);
  }

  private async preferencesSecretKey(): Promise<string> {
    return this.secretService.getSecret('preferences', 'url_token');
  }

  async encrypt(text: string): Promise<string> {
    const preferencesSecretKey = await this.preferencesSecretKey();
    const cipher = crypto.createCipheriv(
      this.algorithm,
      preferencesSecretKey,
      this.iv,
    );

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return `${this.iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  async decrypt(hash): Promise<string> {
    let hashToUse = hash.split(':');
    if (hashToUse.length < 2) {
      throw new Error('Invalid token for preferences');
    }
    let iv = hash.split(':')[0];
    let content = hash.split(':')[1];
    const preferencesSecretKey = await this.preferencesSecretKey();
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      preferencesSecretKey,
      Buffer.from(iv, 'hex'),
    );

    const decrpyted = Buffer.concat([
      decipher.update(Buffer.from(content, 'hex')),
      decipher.final(),
    ]);
    return decrpyted.toString();
  }

  /**
   * this function will decrypt with secretkey from env variable CRYPTO_ENCRYPTION_KEY, default value is document_encryption_key
   * iv is taken from env variable CRYPTO_ENCRYPTION_IV_KEY, default value is document_iv_key
   * @param object
   * @returns
   */
  genericDecrypt<T>(encrypted: string): T {
    // Base64 URL Decoding
    encrypted = decodeURIComponent(encrypted);
    const decipher = crypto.createDecipheriv(
      'aes-256-ctr',
      this.secret,
      this.iv,
    );
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  /**
   * this function will encrypt with secretkey from env variable CRYPTO_ENCRYPTION_KEY, default value is document_encryption_key
   * iv is taken from env variable CRYPTO_ENCRYPTION_IV_KEY, default value is document_iv_key
   * @param object
   * @returns
   */
  genericEncrypt<T>(object: T): string {
    const cipher = crypto.createCipheriv('aes-256-ctr', this.secret, this.iv);
    let encrypted = cipher.update(JSON.stringify(object), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    // Base64 URL Encoding
    return encodeURIComponent(encrypted);
  }

  async generateSignature(stringToSign: string) {
    const digest = crypto.createHash('sha256').update(stringToSign).digest();
    return Buffer.from(digest).toString('base64');
  }
  async generateRandomString(characters: string, noOfLength: number) {
    const charactersLength = characters.length;
    let result = '';

    for (let i = 0; i < noOfLength; i++) {
      const randomIndex = crypto.randomInt(0, charactersLength);
      result += characters.charAt(randomIndex);
    }
    return result;
  }

  generateHashWithSalt(response: Record<string, any>, salt: string): string {
    const sortedKeys = Object.keys(response).sort();
    const sortedObject = sortedKeys.reduce((obj, key) => {
      obj[key] = response[key];
      return obj;
    }, {});
    const stringified = JSON.stringify(sortedObject);

    // Include salt in the hashing process
    return crypto.createHmac('sha256', salt).update(stringified).digest('hex');
  }
}
