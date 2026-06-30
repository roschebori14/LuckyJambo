export function canJoinMatch(creatorId: string, joiningUserId: string) {
  return creatorId !== joiningUserId;
}

export function calculatePrizePool(stake: number) {
  return stake * 2;
}
