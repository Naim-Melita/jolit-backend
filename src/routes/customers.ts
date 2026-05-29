import { Router } from "express";
import { getMeCustomer } from "../controllers/customers.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middlewares/clerk.js";

export const customersRouter = Router();

customersRouter.get("/me", requireAuth, asyncHandler(getMeCustomer));
