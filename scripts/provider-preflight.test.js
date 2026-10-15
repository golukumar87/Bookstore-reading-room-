import { describe, expect, it } from 'vitest'
import { evaluateProviderReadiness } from './provider-preflight'

const completeShiprocketSandbox = {
  SHIPROCKET_EMAIL: 'sandbox-user@example.test',
  SHIPROCKET_PASSWORD: 'not-a-real-password',
  SHIPROCKET_PICKUP_LOCATION: 'Test Warehouse',
  SHIPROCKET_PACKAGE_LENGTH_CM: '20',
  SHIPROCKET_PACKAGE_BREADTH_CM: '15',
  SHIPROCKET_PACKAGE_HEIGHT_CM: '4',
  SHIPROCKET_PACKAGE_WEIGHT_KG: '0.5',
  SHIPROCKET_API_BASE_URL: 'https://sandbox.example.test/v1'
}

describe('provider preflight', () => {
  it('accepts only Razorpay test keys and a non-production HTTPS Shiprocket host', () => {
    const checks = evaluateProviderReadiness({
      ...completeShiprocketSandbox,
      RAZORPAY_KEY_ID: 'rzp_test_example',
      RAZORPAY_KEY_SECRET: 'test-secret'
    })
    expect(checks.razorpay.ready).toBe(true)
    expect(checks.shiprocket.ready).toBe(true)
  })

  it('rejects live Razorpay keys and the Shiprocket production URL', () => {
    const checks = evaluateProviderReadiness({
      ...completeShiprocketSandbox,
      SHIPROCKET_API_BASE_URL: 'https://apiv2.shiprocket.in/v1/external',
      RAZORPAY_KEY_ID: 'rzp_live_not-for-tests',
      RAZORPAY_KEY_SECRET: 'secret'
    })
    expect(checks.razorpay.ready).toBe(false)
    expect(checks.shiprocket.ready).toBe(false)
  })

  it('never exposes provider secrets in result messages', () => {
    const checks = evaluateProviderReadiness({
      RAZORPAY_KEY_ID: 'rzp_test_hidden',
      RAZORPAY_KEY_SECRET: 'do-not-print-this'
    })
    expect(JSON.stringify(checks)).not.toContain('do-not-print-this')
  })
})
