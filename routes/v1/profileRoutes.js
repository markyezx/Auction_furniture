const express = require("express");
const { getProfile, updateProfile, uploadProfileImage, getLoginHistory } = require("../../controllers/profileController");
const { checkLogin } = require("../../middlewares/authMiddleware");
const multer = require("multer");

const router = express.Router();
const upload = multer();

router.use(checkLogin);

router.get("/", getProfile);
router.put("/", updateProfile);
router.post("/upload", upload.single("image"), uploadProfileImage);
router.get("/history", getLoginHistory); // 📌 เพิ่ม API ดึงประวัติการ Login

module.exports = router;
