import { Router } from "express";
import {
  changeAdminPassword,
  getAdminEmail,
  loginAdmin,
  requireAdmin,
} from "../lib/adminAuth.js";
import { asyncHandler } from "../lib/http.js";
import { adminPasswordSchema } from "../schemas.js";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  res.json(await loginAdmin(email ?? "", password ?? ""));
}));

authRouter.get("/me", requireAdmin, asyncHandler(async (_req, res) => {
  res.json({
    name: "Admin",
    email: await getAdminEmail(),
  });
}));

authRouter.patch("/password", requireAdmin, asyncHandler(async (req, res) => {
  const input = adminPasswordSchema.parse(req.body);
  res.json(await changeAdminPassword(input.currentPassword, input.newPassword));
}));
