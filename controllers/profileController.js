const Profile = require("../schemas/v1/profile.schema");
const User = require("../schemas/v1/user.schema");
const { isValidObjectId } = require("mongoose");
const { uploadImage } = require("../controllers/fileUploadControllers");
const multer = require('multer') // ✅ ต้องเพิ่ม multer ที่นี่

// 📌 ดึงข้อมูลโปรไฟล์
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 🔹 ดึงข้อมูลจาก Profile และ User
    let profile = await Profile.findOne({ user: userId });
    const user = await User.findById(userId);

    if (!profile) {
      if (!user) {
        return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้" });
      }

      profile = new Profile({
        user: userId,
        name: user.user.name || "New User",
        phone: user.user.phone || "",
        address: "",
        profileImage: "",
        loginHistory: [] // ✅ ให้มี loginHistory เป็น array ว่าง
      });

      await profile.save();
    }

    res.status(200).json({ 
      status: "success",
      data: {
        profile: {
          ...profile.toObject(),
          name: user?.user.name || profile.name, 
          phone: user?.user.phone || profile.phone,
          loginHistory: profile?.loginHistory || [] // ✅ ส่ง loginHistory กลับไป
        },
        email: user?.user.email || "",
        loggedInDevices: user?.loggedInDevices || [] // ✅ ส่งข้อมูลอุปกรณ์ที่เคย login
      }
    });
  } catch (err) {
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

// 📌 เพิ่มฟังก์ชัน getLoginHistory
exports.getLoginHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).send({ status: "error", message: "Profile not found" });
    }

    res.status(200).send({ status: "success", data: profile.loginHistory });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};
