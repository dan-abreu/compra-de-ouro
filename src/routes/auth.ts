import { Router } from "express";

import { authCancelSecurityRouter } from "./auth/cancel-security.js";
import { authProfileRouter } from "./auth/profile.js";
import { authSessionRouter } from "./auth/session.js";

const router = Router();

router.use(authSessionRouter);
router.use(authProfileRouter);
router.use(authCancelSecurityRouter);

export { router as authRouter };
