import { z } from "zod";

export const sendFriendRequestSchema = z.object({
  receiver_id: z.string().uuid(),
});

export const respondFriendRequestSchema = z.object({
  request_id: z.string().uuid(),

  action: z.enum(["accepted", "rejected"]),
});
