import { Router } from "express";
import {
  changeAdminPassword,
  getAdminEmail,
  loginAdmin,
  requireAdmin,
} from "../lib/adminAuth.js";
import { adminPasswordSchema } from "../schemas.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  res.json(loginAdmin(email ?? "", password ?? ""));
});

authRouter.get("/me", requireAdmin, (_req, res) => {
  res.json({
    name: "Admin",
    email: getAdminEmail(),
  });
});

authRouter.patch("/password", requireAdmin, (req, res) => {
  const input = adminPasswordSchema.parse(req.body);
  res.json(changeAdminPassword(input.currentPassword, input.newPassword));
});
