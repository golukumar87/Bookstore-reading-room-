import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

export function evaluateProviderReadiness(env) {
  const razorpayReady = Boolean(
    env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') &&
    env.RAZORPAY_KEY_SECRET
  )
  const shiprocketBase = env.SHIPROCKET_API_BASE_URL
  let sandboxUrlReady = false
  if (shiprocketBase) {
    try {
      const url = new URL(shiprocketBase)
      sandboxUrlReady = url.protocol === 'https:' &&
        url.hostname !== 'apiv2.shiprocket.in' &&
        url.hostname !== 'www.apiv2.shiprocket.in'
    } catch {
      sandboxUrlReady = false
    }
  }
  const shiprocketReady = Boolean(
    sandboxUrlReady &&
    env.SHIPROCKET_EMAIL &&
    env.SHIPROCKET_PASSWORD &&
    env.SHIPROCKET_PICKUP_LOCATION &&
    env.SHIPROCKET_PACKAGE_LENGTH_CM &&
    env.SHIPROCKET_PACKAGE_BREADTH_CM &&
    env.SHIPROCKET_PACKAGE_HEIGHT_CM &&
    env.SHIPROCKET_PACKAGE_WEIGHT_KG
  )

  return {
    razorpay: {
      ready: razorpayReady,
      message: razorpayReady
        ? 'Test key and secret are configured; this check does not contact Razorpay.'
        : 'Set a Razorpay rzp_test_ key ID and its secret; live keys are not accepted.'
    },
    shiprocket: {
      ready: shiprocketReady,
      message: shiprocketReady
        ? 'Sandbox URL and required shipping settings are configured; this check does not contact Shiprocket.'
        : 'Use a Shiprocket-provisioned HTTPS sandbox URL (not the production host) and configure private credentials, pickup, and parcel dimensions.'
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = evaluateProviderReadiness(process.env)
  for (const [provider, check] of Object.entries(result)) {
    console.log(`${provider}: ${check.ready ? 'READY' : 'NOT READY'} — ${check.message}`)
  }
  console.log('No provider API calls, payments, refunds, or shipments were created.')
  if (Object.values(result).some((check) => !check.ready)) process.exitCode = 1
}
