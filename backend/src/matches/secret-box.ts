import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export class SecretBox {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    if (!/^[a-f\d]{64}$/i.test(hexKey)) {
      throw new Error('CS2_SECRET_KEY must contain exactly 64 hexadecimal characters.');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, nonce.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
  }

  decrypt(payload: string): string {
    const [version, encodedNonce, encodedTag, encodedCiphertext] = payload.split('.');
    if (version !== VERSION || !encodedNonce || !encodedTag || encodedCiphertext === undefined) {
      throw new Error('Invalid encrypted secret payload.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(encodedNonce, 'base64url'));
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
