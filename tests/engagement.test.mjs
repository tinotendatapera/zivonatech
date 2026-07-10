import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveReactionAction, sumReactionCounts } from '../lib/engagement.mjs'

test('resolveReactionAction removes an existing reaction when the same emoji is clicked again', () => {
  assert.equal(resolveReactionAction('love', 'love'), 'remove')
})

test('resolveReactionAction replaces an existing different reaction with the new one', () => {
  assert.equal(resolveReactionAction('love', 'haha'), 'replace')
})

test('resolveReactionAction adds a new reaction when none exists yet', () => {
  assert.equal(resolveReactionAction(null, 'wow'), 'add')
})

test('sumReactionCounts totals the aggregate reaction count across all types', () => {
  assert.equal(sumReactionCounts({ like: 2, love: 1, haha: 0, wow: 1, sad: 0, angry: 0 }), 4)
})
