import { NextFunction, Request, Response } from "express";

import { verifyAndDecodeJwt } from "../lib/jwt.js";

const JWT_SECRET = process.env.JWT_SECRET?.trim();

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured.",
        code: "CONFIGURATION_ERROR",
        fieldErrors: {}
      });
    }

    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header with Bearer token is required.",
        code: "MISSING_AUTH_HEADER",
        fieldErrors: {}
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const payload = verifyAndDecodeJwt(token, JWT_SECRET);

    // Attach userId to request
    req.userId = payload.userId;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        return res.status(401).json({
          message: "JWT token has expired.",
          code: "EXPIRED_TOKEN",
          fieldErrors: {}
        });
      }
      if (error.message.includes("Invalid")) {
        return res.status(401).json({
          message: "Invalid JWT token.",
          code: "INVALID_TOKEN",
          fieldErrors: {}
        });
      }
    }

    return res.status(401).json({
      message: "Authentication failed.",
      code: "AUTH_FAILED",
      fieldErrors: {}
    });
  }
};
