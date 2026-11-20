import twilio from 'twilio'

export function createTwilioProvider(env = process.env) {
  const approved = env.TWILIO_RESALE_APPROVED === 'true'
  const accountSid = env.TWILIO_ACCOUNT_SID
  const authToken = env.TWILIO_AUTH_TOKEN

  return {
    isEnabled: Boolean(approved && accountSid && authToken),
    async listAvailableNumbers({ countryCode }) {
      if (!approved)
        throw new Error(
          'Twilio purchasing is disabled until the intended allocation and resale model is approved.',
        )
      if (!accountSid || !authToken)
        throw new Error('Twilio credentials are not configured on the server.')
      const client = twilio(accountSid, authToken)
      const inventory = await client
        .availablePhoneNumbers(countryCode)
        .local.list({ limit: 20, smsEnabled: true })
      return inventory.map((number) => ({
        phoneNumber: number.phoneNumber,
        countryCode,
        capabilities: number.capabilities,
      }))
    },
    async purchaseNumber({ phoneNumber }) {
      if (!approved)
        throw new Error(
          'Twilio purchasing is disabled until the intended allocation and resale model is approved.',
        )
      if (!accountSid || !authToken)
        throw new Error('Twilio credentials are not configured on the server.')
      if (!env.NUMORA_TWILIO_SMS_WEBHOOK_URL)
        throw new Error('The signed SMS webhook URL is not configured.')
      const client = twilio(accountSid, authToken)
      const number = await client.incomingPhoneNumbers.create({
        phoneNumber,
        smsUrl: env.NUMORA_TWILIO_SMS_WEBHOOK_URL,
        smsMethod: 'POST',
      })
      return { sid: number.sid, phoneNumber: number.phoneNumber }
    },
    async receiveMessage() {
      throw new Error(
        'Live inbound SMS requires a verified Twilio webhook endpoint and signature validation.',
      )
    },
  }
}
