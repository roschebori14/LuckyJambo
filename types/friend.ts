export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface FriendRequest {
  id: string;

  sender_id: string;

  receiver_id: string;

  status: FriendRequestStatus;

  created_at: string;

  updated_at: string;
}

export interface Friend {
  id: string;

  user_id: string;

  friend_id: string;

  created_at: string;
}
