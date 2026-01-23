import { client, preapproval, customer, card } from '@/lib/mercadopago';
import { MercadoPagoConfig } from 'mercadopago';

// Mockeamos el módulo mercadopago
jest.mock('mercadopago');

describe('Mercado Pago Lib', () => {
  it('should initialize MercadoPagoConfig with access token', () => {
    expect(MercadoPagoConfig).toHaveBeenCalledTimes(1);
    expect(client).toBeDefined();
  });

  it('should initialize PreApproval resource', () => {
    expect(preapproval).toBeDefined();
  });

  it('should initialize Customer resource', () => {
    expect(customer).toBeDefined();
  });

  it('should initialize CustomerCard resource', () => {
    expect(card).toBeDefined();
  });
});
