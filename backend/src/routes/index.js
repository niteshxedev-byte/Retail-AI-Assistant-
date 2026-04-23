import { Router } from "express";
import loginRouter from "./auth/loginUser.js";
import registerRouter from "./auth/registerUser.js";

const router = Router();

router.use("/auth", loginRouter);
router.use("/auth", registerRouter);

export default router;