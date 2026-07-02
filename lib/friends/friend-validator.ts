import { z } from "zod";

export const sendFriendRequestSchema = z.object({
  receiver_id: z.string().uuid(),
});

export const respondFriendRequestSchema = z.object({
  request_id: z.string().uuid(),

  action: z.enum(["accepted", "rejected"]),
});

export const searchUsernameSchema = z.object({
  q: z.string().trim().min(1).max(50),
});

export const acceptInviteSchema = z.object({
  code: z.string().trim().min(1).max(50),
});
