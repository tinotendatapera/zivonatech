export function resolveReactionAction(existingReactionType, incomingReactionType) {
  if (!existingReactionType) {
    return 'add'
  }

  if (existingReactionType === incomingReactionType) {
    return 'remove'
  }

  return 'replace'
}

export function sumReactionCounts(reactions = {}) {
  return Object.values(reactions).reduce((sum, count) => sum + Number(count || 0), 0)
}
