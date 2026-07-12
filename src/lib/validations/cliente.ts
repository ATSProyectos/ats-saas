import { z } from "zod";

export const clienteSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(200),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
