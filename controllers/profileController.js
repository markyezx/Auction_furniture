const Profile = require("../schemas/v1/profile.schema");
const User = require("../schemas/v1/user.schema");
const { isValidObjectId } = require("mongoose");
const { uploadImage } = require("../controllers/fileUploadControllers");

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

// 📌 อัปโหลดรูปโปรไฟล์
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ status: "error", message: "No file uploaded" });
    }
    const userId = req.user.userId;
    const fileUrl = await uploadImage(req.file.buffer, `profile/${userId}.jpg`);

    const profile = await Profile.findOneAndUpdate({ user: userId }, { profileImage: fileUrl }, { new: true });

    if (!profile) {
      return res.status(404).send({ status: "error", message: "Profile not found" });
    }
    res.status(200).send({ status: "success", data: { imageUrl: fileUrl } });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
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
