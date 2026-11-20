export function requireString(value, field, maxLength = 120) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Invalid ${field}.`)
  }
  return value.trim()
}

export function requireAmount(value) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 500 || amount > 10000000) {
    throw new Error('Amount must be a whole Naira value between 500 and 10,000,000.')
  }
  return amount
}

export function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}
