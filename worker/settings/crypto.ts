export interface EncryptedToken {
  version: 1;
  nonce: string;
  ciphertext: string;
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function keyFor(hex: string) {
  if (!/^[a-f\d]{64}$/i.test(hex))
    throw new Error('加密主密钥需要 32 字节十六进制值，请配置 TOKEN_ENCRYPTION_KEY');
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function encryptToken(plaintext: string, hex: string): Promise<EncryptedToken> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    await keyFor(hex),
    new TextEncoder().encode(plaintext),
  );
  return { version: 1, nonce: encode(nonce), ciphertext: encode(new Uint8Array(ciphertext)) };
}
export async function decryptToken(value: EncryptedToken, hex: string) {
  try {
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: decode(value.nonce) },
        await keyFor(hex),
        decode(value.ciphertext),
      ),
    );
  } catch {
    throw new Error('无法解密已保存的 Token，请检查加密主密钥或重新配置 Token');
  }
}
