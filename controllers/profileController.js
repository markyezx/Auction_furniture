const Profile = require("../schemas/v1/profile.schema");
const User = require("../schemas/v1/user.schema");
const { isValidObjectId } = require("mongoose");
const { uploadImage } = require("../controllers/fileUploadControllers");
const multer = require('multer') // ✅ ต้องเพิ่ม multer ที่นี่

// 📌 ดึงข้อมูลโปรไฟล์
exports.getProfile = async (req, res) => {
    try {
      const userId = req.user.userId;
  
      let profile = await Profile.findOne({ user: userId });
  
      // 📌 ถ้ายังไม่มี Profile ให้สร้างใหม่อัตโนมัติ
      if (!profile) {
        profile = new Profile({ user: userId, name: "New User", phone: "", address: "", profileImage: "" });
        await profile.save();
      }
  
      res.status(200).send({ status: "success", data: profile });
    } catch (err) {
      res.status(500).send({ status: "error", message: err.message });
    }
  };

// 📌 อัปเดตข้อมูลโปรไฟล์
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, address } = req.body;

    const profile = await Profile.findOneAndUpdate({ user: userId }, { name, phone, address }, { new: true });

    if (!profile) {
      return res.status(404).send({ status: "error", message: "Profile not found" });
    }
    res.status(200).send({ status: "success", data: profile });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
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
exports.uploadProfileImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: "fail", message: "กรุณาอัปโหลดรูปภาพ" })
  }

  const imageUrl = `/uploads/${req.file.filename}` // ✅ URL รูปที่อัปโหลด

  Profile.findOneAndUpdate({ email: req.user.email }, { profileImage: imageUrl }, { new: true })
    .then(updatedProfile => res.json({ status: "success", imageUrl: imageUrl })) // ✅ ส่ง URL กลับไปที่ Frontend
    .catch(err => res.status(500).json({ status: "fail", message: err.message }))
}


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
