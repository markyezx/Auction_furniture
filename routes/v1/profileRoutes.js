const express = require("express");
const { getProfile, updateProfile, getLoginHistory, uploadProfileImage } = require("../../controllers/profileController");
const { checkLogin } = require("../../middlewares/authMiddleware");
const multer = require("multer");
const Profile = require("../../schemas/v1/profile.schema"); // นำเข้า Profile Model

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // ใช้ memoryStorage() เพื่อดึงไฟล์จาก buffer

router.use(checkLogin);

router.get("/", getProfile);
router.put("/", updateProfile);
router.get("/history", getLoginHistory);

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
      console.log("User Info:", req.user); 
      console.log("🔍 Debug Uploaded File:", req.file); // ✅ ตรวจสอบไฟล์ที่ได้รับ

      if (!req.user || !req.user.userId) {
          return res.status(401).json({ error: "Unauthorized: กรุณาเข้าสู่ระบบ" });
      }

      if (!req.file) {
          return res.status(400).json({ error: "กรุณาอัปโหลดไฟล์ภาพ" });
      }

      const profile = await Profile.findOne({ user: req.user.userId });
      if (!profile) {
          return res.status(404).json({ error: "ไม่พบโปรไฟล์ของผู้ใช้" });
      }

      profile.profileImage = {
          data: Buffer.from(req.file.buffer), // ✅ ป้องกันการบันทึก Buffer ผิดพลาด
          contentType: req.file.mimetype
      };

      await profile.save();
      console.log("✅ Image Uploaded Successfully!");
      res.json({ message: "อัปโหลดรูปโปรไฟล์สำเร็จ!" });

  } catch (error) {
      console.error("🚨 Upload Error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" });
  }
});

router.get("/image", async (req, res) => {
  try {
      console.log("🛠 Debug req.user:", req.user); 

      if (!req.user || !req.user.userId) {
          return res.status(401).json({ error: "Unauthorized: กรุณาเข้าสู่ระบบ" });
      }

      const profile = await Profile.findOne({ user: req.user.userId });

      if (!profile || !profile.profileImage || !profile.profileImage.data) {
          return res.status(404).json({ error: "ไม่พบรูปโปรไฟล์" });
      }

      console.log("🖼 Debug Profile Image:", profile.profileImage);

      res.json({
          image: `data:${profile.profileImage.contentType};base64,${profile.profileImage.data.toString("base64")}`
      });
  } catch (error) {
      console.error("🚨 Get Image Error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงรูปภาพ" });
  }
});

module.exports = router;
