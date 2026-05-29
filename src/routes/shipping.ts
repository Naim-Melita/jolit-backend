import { Router } from "express";
import { postShippingQuote } from "../controllers/shipping.controller.js";
import { asyncHandler } from "../lib/http.js";

export const shippingRouter = Router();

shippingRouter.post("/quote", asyncHandler(postShippingQuote));
