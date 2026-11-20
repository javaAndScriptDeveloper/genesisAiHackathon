import { z } from "zod";

// Shared form schemas. Messages are Ukrainian, shown by our own error UI (never native validation).
export const contactSchema = z.object({
	name: z.string().min(2, "Вкажіть ім’я"),
	email: z.email("Невірний email"),
	message: z.string().min(10, "Мінімум 10 символів"),
});
export type ContactInput = z.infer<typeof contactSchema>;
