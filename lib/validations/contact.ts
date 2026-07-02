import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),

  email: z.string().email("Invalid email address"),

  subject: z.string().min(3, "Subject must be at least 3 characters").max(120),

  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be 2000 characters or fewer"),
});

export type ContactSchema = z.infer<typeof contactSchema>;
