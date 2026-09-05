import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import * as auth from "../controllers/authController.js";
import * as keywords from "../controllers/keywordController.js";
import * as logs from "../controllers/logController.js";
import * as admin from "../controllers/adminController.js";

const router = Router();

const authLimit = rateLimit({
  windowMs: 15 * 60000,
  max: 20,
  keyPrefix: "auth",
  message: "พยายามเข้าสู่ระบบบ่อยเกินไป ลองใหม่ในอีก 15 นาที",
});

const searchLimit = rateLimit({
  windowMs: 60000,
  max: 12,
  keyPrefix: "search",
  message: "ค้นหาถี่เกินไป รอสักครู่แล้วลองใหม่",
});

router.post("/auth/register", authLimit, auth.postRegister);
router.post("/auth/login", authLimit, auth.postLogin);
router.post("/auth/refresh", authLimit, auth.postRefresh);
router.get("/auth/me", requireAuth, auth.getMe);

router.get("/keywords/markets", keywords.markets);
router.get("/keywords/status", requireAuth, keywords.status);
router.post("/keywords/search", requireAuth, searchLimit, keywords.search);
router.post("/keywords/bulk", requireAuth, searchLimit, keywords.bulkSearch);

router.get("/logs", requireAuth, logs.myLogs);

router.get("/admin/users", requireAuth, requireAdmin, admin.listUsers);
router.post("/admin/users", requireAuth, requireAdmin, admin.createUser);
router.patch("/admin/users/:id", requireAuth, requireAdmin, admin.updateUser);
router.delete("/admin/users/:id", requireAuth, requireAdmin, admin.deleteUser);
router.get("/admin/stats", requireAuth, requireAdmin, admin.stats);
router.get("/admin/logs", requireAuth, requireAdmin, admin.allLogs);

export default router;
