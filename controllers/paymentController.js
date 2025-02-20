const qrcode = require("qrcode");
const generatePayload = require("promptpay-qr");
const QRCodeModel = require("../schemas/v1/QRcode.shema");

// ฟังก์ชันสร้าง QR Code พร้อมเพย์
exports.generatePromptPayQR = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const { recipient, amount } = req.body;

    // ตรวจสอบเบอร์โทรหรือเลขบัตรประชาชน
    if (!recipient || (!/^\d{10}$/.test(recipient) && !/^\d{13}$/.test(recipient))) {
      return res.status(400).json({ error: "หมายเลขพร้อมเพย์ต้องมี 10 หลัก (เบอร์โทรศัพท์) หรือ 13 หลัก (บัตรประชาชน)" });
    }

    // ตรวจสอบจำนวนเงิน
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "จำนวนเงินต้องเป็นตัวเลขและมากกว่า 0" });
    }

    // สร้าง QR Code
    const payload = generatePayload(recipient, { amount: parseFloat(amount) });
    const qrCode = await qrcode.toDataURL(payload);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // หมดอายุใน 3 นาที

    // บันทึกลง MongoDB
    const qrCodeData = new QRCodeModel({
      recipient,
      amount: parseFloat(amount),
      payload,
      qrCode,
      expiresAt,
      isPaid: false,
      slipImage: null, // เพิ่มคอลัมน์สำหรับอัปโหลดสลิป
    });

    await qrCodeData.save();

    res.status(200).json({
      success: true,
      message: "สร้าง QR Code สำเร็จ",
      qrCode,
      payload,
      expiresAt,
    });
  } catch (error) {
    console.error("Error generating QR Code:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

// ฟังก์ชันตรวจสอบสถานะการชำระเงิน
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const qrCodeData = await QRCodeModel.findById(id);

    if (!qrCodeData) {
      return res.status(404).json({ error: "ไม่พบ QR Code" });
    }

    // ตรวจสอบว่า QR Code หมดอายุหรือยัง
    if (new Date() > qrCodeData.expiresAt) {
      qrCodeData.isPaid = false;
      await qrCodeData.save();
      return res.status(400).json({ error: "QR Code หมดอายุแล้ว" });
    }

    res.status(200).json({
      success: true,
      qrCodeId: id,
      isPaid: qrCodeData.isPaid,
      slipImage: qrCodeData.slipImage,
      message: qrCodeData.isPaid ? "การชำระเงินสำเร็จ" : "ยังไม่ได้ทำการชำระเงิน",
    });
  } catch (error) {
    console.error("Error checking payment status:", error.message);
    res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

// ฟังก์ชันสำหรับอัปโหลดสลิป
exports.uploadSlip = async (req, res) => {
  try {
    const { id } = req.params;
    const slipImage = req.file ? req.file.path : null; // ใช้ multer เพื่ออัปโหลดไฟล์

    if (!slipImage) {
      return res.status(400).json({ error: "กรุณาอัปโหลดรูปภาพสลิป" });
    }

    const qrCodeData = await QRCodeModel.findById(id);

    if (!qrCodeData) {
      return res.status(404).json({ error: "ไม่พบ QR Code" });
    }

    // อัปเดตข้อมูลสลิปในฐานข้อมูล
    qrCodeData.slipImage = slipImage;
    qrCodeData.isPaid = true;
    await qrCodeData.save();

    res.status(200).json({
      success: true,
      message: "อัปโหลดสลิปสำเร็จ",
      slipImage,
    });
  } catch (error) {
    console.error("Error uploading slip:", error.message);
    res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

const checkPaymentsAutomatically = async () => {
  console.log("🔄 กำลังตรวจสอบสถานะการชำระเงิน...");
  try {
    const pendingPayments = await QRCodeModel.find({ isPaid: false, expiresAt: { $gte: new Date() } });

    for (const payment of pendingPayments) {
      // 📌 สมมติว่าเราเชื่อมต่อ API ธนาคารเพื่อตรวจสอบสถานะ
      const isPaid = await checkBankPaymentStatus(payment.payload); 

      if (isPaid) {
        payment.isPaid = true;
        await payment.save();
        console.log(`✅ อัปเดตการชำระเงินสำเร็จ: ${payment._id}`);
      }
    }
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการตรวจสอบการชำระเงิน:", error);
  }
};

// 📌 รันตรวจสอบทุกๆ 5 นาที
setInterval(checkPaymentsAutomatically, 5 * 60 * 1000);
