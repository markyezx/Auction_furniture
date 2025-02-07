// controllers/fileUploadControllers.js
const { OSSStorage } = require("../modules/storage/oss");

const fileUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ status: "error", message: "No file uploaded" });
        }
        const result = await OSSStorage.put(`uploads/${req.file.originalname}`, Buffer.from(req.file.buffer));
        res.status(200).send({ message: "File Uploaded", result: result });
    } catch (err) {
        res.status(500).send({ status: "error", message: err.message });
    }
};

const uploadImage = async (buffer, filePath) => {
    try {
      const result = await OSSStorage.put(filePath, buffer);
      return result.url; // คืน URL ของไฟล์ที่อัปโหลด
    } catch (err) {
      throw new Error("Upload failed: " + err.message);
    }
  };


module.exports = { fileUpload, uploadImage };

