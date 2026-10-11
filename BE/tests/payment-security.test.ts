import { createHmac } from 'node:crypto';
import { PayOS } from '@payos/node';
import { describe, it, expect } from 'vitest';
import { PayosGateway } from '../src/modules/payments/gateways/payos.gateway.js';
import {
  issueCode,
  revealCode,
  ticketHash,
} from '../src/modules/tickets/issuance/ticket.crypto.js';
import { admissionInput } from '../src/modules/tickets/http/ticket.schema.js';
const checksum = 'fixture-checksum-only';
const gateway = new PayosGateway(
  new PayOS({
    clientId: 'fixture-client',
    apiKey: 'fixture-api',
    checksumKey: checksum,
    logLevel: 'off',
  }),
);
function signed(data: Record<string, string | number>) {
  const source = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('&');
  return {
    code: '00',
    desc: 'Success',
    success: true,
    data,
    signature: createHmac('sha256', checksum).update(source).digest('hex'),
  };
}
const data = {
  orderCode: 123,
  amount: 10000,
  reference: 'fixture-reference',
  paymentLinkId: 'fixture-link',
  currency: 'VND',
  code: '00',
};
describe('payment and ticket security', () => {
  it('uses the real SDK to verify signed receipt and excludes raw bank fields', async () => {
    const receipt = await gateway.verify(signed({ ...data, accountNumber: 'fixture-account' }));
    expect(receipt).toEqual({ ...data, orderCode: '123', amount: '10000' });
  });
  it('rejects tampered receipt and wrong checksum', async () => {
    const body = signed(data);
    await expect(
      gateway.verify({ ...body, data: { ...data, amount: 20000 } }),
    ).rejects.toMatchObject({ code: 'INVALID_PAYMENT_WEBHOOK' });
    await expect(gateway.verify({ ...body, signature: '0'.repeat(64) })).rejects.toMatchObject({
      code: 'INVALID_PAYMENT_WEBHOOK',
    });
  });
  it('uses signed data status rather than unsigned outer success', async () => {
    expect(
      (await gateway.verify({ ...signed({ ...data, code: '99' }), success: true, code: '00' }))
        .code,
    ).toBe('99');
  });
  it('binds encrypted QR credentials to item/session and detects modification', () => {
    const one = issueCode('1', '2'),
      two = issueCode('1', '2'),
      plain = revealCode(one.ciphertext, '1', '2', one.version);
    expect(plain).toMatch(/^EVX-[A-F0-9]{32}$/);
    expect(ticketHash(plain).equals(one.hash)).toBe(true);
    expect(one.hash.equals(two.hash)).toBe(false);
    expect(one.ciphertext.includes(Buffer.from(plain))).toBe(false);
    expect(() => revealCode(one.ciphertext, '3', '2', one.version)).toThrow();
    const corrupt = Buffer.from(one.ciphertext);
    corrupt[30] = corrupt[30]! ^ 1;
    expect(() => revealCode(corrupt, '1', '2', one.version)).toThrow();
  });
  it('requires explicit physical document confirmation', () => {
    const input = {
      ticketCode: 'EVX-' + 'A'.repeat(32),
      cccd: '000000000000',
      fullName: 'Fixture',
      dateOfBirth: '1990-01-01',
    };
    expect(admissionInput.safeParse(input).success).toBe(false);
    expect(admissionInput.safeParse({ ...input, physicalDocumentSeen: false }).success).toBe(false);
    expect(admissionInput.safeParse({ ...input, physicalDocumentSeen: true }).success).toBe(true);
  });
});
