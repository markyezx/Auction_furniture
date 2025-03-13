const Profile = require("../schemas/v1/profile.schema");
const User = require("../schemas/v1/user.schema");
const { isValidObjectId } = require("mongoose");
const { uploadImage } = require("../controllers/fileUploadControllers");
const multer = require('multer') // ✅ ต้องเพิ่ม multer ที่นี่

const uaParser = require('ua-parser-js');
const geoip = require('geoip-lite');
// 📌 ฟังก์ชันแปลง Binary เป็น Base64 URL
const getBase64Image = (profileImage) => {
  if (!profileImage || !profileImage.data) return null;
  return `data:${profileImage.contentType};base64,${profileImage.data.toString("base64")}`;
};

// 📌 ดึงข้อมูลโปรไฟล์ พร้อม `email` และ `phone` จาก `User`
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // ✅ `populate("user")` เพื่อดึง `email` และ `phone`
    const profile = await Profile.findOne({ user: userId }).populate("user");

    if (!profile) {
      return res.status(404).json({ status: "error", message: "ไม่พบข้อมูลโปรไฟล์" });
    }

    console.log("📌 Debug User Data:", profile.user);

    res.status(200).json({
      status: "success",
      data: {
        name: profile.name,
        email: profile.user?.user?.email || "ไม่มีอีเมล",  // ✅ ดึง `email` จาก `user.user.email`
        phone: profile.user?.user?.phone || "ไม่มีเบอร์โทร",  // ✅ ดึง `phone` จาก `user.user.phone`
        address: profile.address || "ไม่ระบุ",
        profileImage: getBase64Image(profile.profileImage),
        createdAt: profile.createdAt
      }
    });
  } catch (err) {
    console.error("❌ Error in getProfile:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};


// 📌 อัปเดตข้อมูลโปรไฟล์
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, address } = req.body;

    // 🔹 อัปเดตข้อมูลใน Profile
    const profile = await Profile.findOneAndUpdate(
      { user: userId }, 
      { name, phone, address }, 
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ status: "error", message: "ไม่พบโปรไฟล์" });
    }

    // 🔹 อัปเดตข้อมูลใน User
    const user = await User.findByIdAndUpdate(
      userId,
      { "user.name": name, "user.phone": phone }, 
      { new: true }
    );

    res.status(200).json({ status: "success", data: { profile, user } });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};


// 📌 ตั้งค่าการอัปโหลดไฟล์ด้วย `multer`
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/') // ✅ เก็บไฟล์ในโฟลเดอร์ `public/uploads/`
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({ storage })

// 📌 อัปโหลดรูปโปรไฟล์
exports.uploadProfileImage = async (req, res) => {
  try {
    console.log("📸 Uploading Image for User:", req.user);
    console.log("🔍 File Received:", req.file); // ✅ ตรวจสอบไฟล์ที่ได้รับ

    if (!req.file) {
      return res.status(400).json({ status: "fail", message: "กรุณาอัปโหลดรูปภาพ" });
    }

    const userId = req.user.userId;
    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({ status: "fail", message: "Profile not found" });
    }

    console.log("🛠 Debug: Updating profile image...");

    // ✅ บันทึกไฟล์ภาพลงในฐานข้อมูล MongoDB
    profile.profileImage = {
      data: Buffer.from(req.file.buffer), // ✅ แปลง buffer ก่อนบันทึก
      contentType: req.file.mimetype
    };

    await profile.save();

    console.log("✅ Image Uploaded Successfully");
    res.json({ status: "success", message: "อัปโหลดรูปโปรไฟล์สำเร็จ!" });
  } catch (error) {
    console.error("🚨 Upload Error:", error);
    res.status(500).json({ status: "error", message: "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" });
  }
};

// 📌 ฟังก์ชันบันทึกการเข้าสู่ระบบ
exports.recordLoginHistory = async (req, userId) => {
  try {
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return;
    }

    // 📌 ดึงข้อมูลอุปกรณ์, OS, Browser และที่ตั้ง
    const userAgent = uaParser(req.headers["user-agent"]);
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const geo = geoip.lookup(ip) || {};

    // 📌 สร้างข้อมูลการเข้าสู่ระบบ
    const loginEntry = {
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
      device: `${userAgent.device.vendor || "Unknown"} ${userAgent.device.model || ""}`,
      os: `${userAgent.os.name} ${userAgent.os.version}`,
      browser: `${userAgent.browser.name} ${userAgent.browser.version}`,
      location: `${geo.city || "Unknown"}, ${geo.country || "Unknown"}`,
      timestamp: new Date(),
    };

    // 📌 จำกัดประวัติให้เก็บ 10 รายการ
    profile.loginHistory.unshift(loginEntry);
    if (profile.loginHistory.length > 10) {
      profile.loginHistory.pop();
    }

    await profile.save();
  } catch (err) {
    console.error("Error recording login history:", err);
  }
};

// 📌 ดึงข้อมูลประวัติการเข้าสู่ระบบ
exports.getLoginHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ status: "error", message: "Unauthorized: กรุณาเข้าสู่ระบบ" });
    }

    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({ status: "error", message: "ไม่พบโปรไฟล์ของผู้ใช้" });
    }

    return res.status(200).json({ 
      status: "success", 
      data: { loginHistory: profile.loginHistory || [] } 
    });

  } catch (err) {
    console.error("🚨 getLoginHistory Error:", err);
    res.status(500).json({ status: "error", message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
};