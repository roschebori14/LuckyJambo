export function isSelfRequest(senderId: string, receiverId: string) {
  return senderId === receiverId;
}

export function buildFriendPair(userId: string, friendId: string) {
  return {
    user_id: userId,
    friend_id: friendId,
  };
}
