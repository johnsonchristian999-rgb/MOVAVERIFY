import test from 'node:test'
import assert from 'node:assert/strict'
import { constantTimeEqual, requireAmount, requireString } from '../src/validation.js'

test('requires bounded, non-empty strings', () => {
  assert.equal(requireString('  NG  ', 'country'), 'NG')
  assert.throws(() => requireString('', 'country'))
  assert.throws(() => requireString('x'.repeat(121), 'country'))
})

test('accepts only safe whole-Naira amounts in range', () => {
  assert.equal(requireAmount(500), 500)
  assert.throws(() => requireAmount(499))
  assert.throws(() => requireAmount(500.5))
  assert.throws(() => requireAmount(10000001))
})

test('compares webhook signatures without accepting unequal values', () => {
  assert.equal(constantTimeEqual('signature', 'signature'), true)
  assert.equal(constantTimeEqual('signature', 'signaturE'), false)
  assert.equal(constantTimeEqual('short', 'longer'), false)
})
