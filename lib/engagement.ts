export function resolveReactionAction(existingReactionType: string | null | undefined, incomingReactionType: string) {
  if (!existingReactionType) {
    return 'add'
  }

  if (existingReactionType === incomingReactionType) {
    return 'remove'
  }

  return 'replace'
}

export function sumReactionCounts(reactions: Record<string, number | string | null | undefined> = {}) {
  return Object.values(reactions).reduce<number>((sum, count) => sum + Number(count || 0), 0)
}
