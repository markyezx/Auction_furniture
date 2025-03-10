const qrcode = require("qrcode");
const generatePayload = require("promptpay-qr");
const QRCodeModel = require("../schemas/v1/QRcode.shema");
const Auction = require("../schemas/v1/auction.schema");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch"); // ✅ ใช้ fetch เพื่อเรียก API ภายใน Backend

  
// 📌 ฟังก์ชันอัปโหลดสลิป
exports.uploadSlip = async (req, res) => {
  try {
    const { id } = req.params;
    const slipImage = req.file ? req.file.path : null; // ใช้ multer อัปโหลดไฟล์

    if (!slipImage) {
      return res.status(400).json({ error: "กรุณาอัปโหลดรูปภาพสลิป" });
    }

    const qrCodeData = await QRCodeModel.findById(id);

    if (!qrCodeData) {
      return res.status(404).json({ error: "ไม่พบ QR Code" });
    }

    // ✅ อัปเดตสถานะการชำระเงิน
    qrCodeData.slipImage = slipImage;
    qrCodeData.isPaid = true;
    await qrCodeData.save();

    res.status(200).json({
      success: true,
      message: "อัปโหลดสลิปสำเร็จ",
      slipImage,
    });
  } catch (error) {
    console.error("❌ Error uploading slip:", error.message);
    res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

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
    console.log(`🔍 Checking status for QR Code ID: ${id}`);
    
    const qrCodeData = await QRCodeModel.findById(id);

    if (!qrCodeData) {
      console.log("❌ ไม่พบ QR Code ในฐานข้อมูล");
      return res.status(404).json({ error: "❌ ไม่พบ QR Code" });
    }

    // ✅ ตรวจสอบว่า QR Code หมดอายุหรือไม่
    if (new Date() > qrCodeData.expiresAt) {
      qrCodeData.isPaid = false;
      await qrCodeData.save();
      return res.status(400).json({ error: "⏳ QR Code หมดอายุแล้ว" });
    }

    console.log(`✅ Payment status: ${qrCodeData.isPaid ? "PAID" : "NOT PAID"}`);

    res.status(200).json({
      success: true,
      isPaid: qrCodeData.isPaid,
      slipImage: qrCodeData.slipImage,
      message: qrCodeData.isPaid ? "✅ การชำระเงินสำเร็จแล้ว" : "⏳ ยังไม่ได้ชำระเงิน",
    });
  } catch (error) {
    console.error("❌ Error checking payment status:", error.message);
    res.status(500).json({ error: "❌ เกิดข้อผิดพลาดในระบบ" });
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
      // 📌 ตรวจสอบว่ามีการชำระเงินผ่าน API ธนาคาร (สมมติว่าฟังก์ชัน checkBankPaymentStatus ทำหน้าที่นี้)
      const isPaid = await checkBankPaymentStatus(payment.payload); 

      if (isPaid) {
        payment.isPaid = true;
        await payment.save();

        console.log(`✅ อัปเดตการชำระเงินสำเร็จ: ${payment._id}`);

        // 📌 แจ้งเตือนผู้ขายเมื่อได้รับการชำระเงิน
        notifySeller(payment);
      }
    }
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการตรวจสอบการชำระเงิน:", error);
  }
};

exports.generateSellerQR = async (req, res) => {
  try {
    const { auctionId, recipient, amount } = req.body;

    if (!recipient || !amount || !auctionId) {
      return res.status(400).json({ error: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // ✅ สร้าง QR Code
    const payload = generatePayload(recipient, { amount: parseFloat(amount) });
    const qrCodeDataUrl = await qrcode.toDataURL(payload);
    const paymentId = uuidv4(); // ✅ สร้าง `paymentId` แบบสุ่ม

    // ✅ บันทึก QR Code ลง `QRCodeSchema`
    const qrCodeEntry = await QRCodeModel.create({
      auctionId,
      recipient,
      amount,
      payload,
      qrCode: qrCodeDataUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // ✅ หมดอายุใน 24 ชั่วโมง
      isPaid: false,
    });

    // ✅ อัปเดต `Auction` ให้บันทึก `qrCode` และ `paymentId`
    const updatedAuction = await Auction.findByIdAndUpdate(
      auctionId,
      { qrCode: qrCodeDataUrl, paymentId },
      { new: true }
    );

    if (!updatedAuction) {
      return res.status(404).json({ error: "❌ ไม่พบการประมูล" });
    }

    res.status(200).json({
      success: true,
      message: "✅ สร้าง QR Code สำเร็จ และบันทึกลงฐานข้อมูล",
      qrCode: qrCodeDataUrl,
      paymentId,
      auctionId
    });
  } catch (error) {
    console.error("❌ Error generating QR Code:", error);
    res.status(500).json({ error: "❌ เกิดข้อผิดพลาดในระบบ" });
  }
};

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const qrCodeData = await QRCodeModel.findById(id);

    if (!qrCodeData) {
      return res.status(404).json({ error: "❌ ไม่พบ QR Code นี้" });
    }

    // ✅ ตรวจสอบว่า QR Code หมดอายุหรือไม่
    if (new Date() > qrCodeData.expiresAt) {
      qrCodeData.isPaid = false;
      await qrCodeData.save();
      return res.status(400).json({ error: "⏳ QR Code หมดอายุแล้ว" });
    }

    res.status(200).json({
      success: true,
      isPaid: qrCodeData.isPaid,
      slipImage: qrCodeData.slipImage,
      message: qrCodeData.isPaid ? "✅ การชำระเงินสำเร็จแล้ว" : "⏳ ยังไม่ได้ชำระเงิน",
    });
  } catch (error) {
    console.error("Error checking payment status:", error.message);
    res.status(500).json({ error: "❌ เกิดข้อผิดพลาดในระบบ" });
  }
};

// 📌 อัปเดต QR Code ในฐานข้อมูล
exports.updateQRForAuction = async (req, res) => {
  try {
    const { qrCode } = req.body;
    const auctionId = req.params.id;

    if (!qrCode) {
      return res.status(400).json({ status: "error", message: "QR Code ไม่สามารถว่างเปล่าได้" });
    }

    const auction = await Auction.findByIdAndUpdate(
      auctionId,
      { qrCode },
      { new: true }
    );

    if (!auction) {
      return res.status(404).json({ status: "error", message: "ไม่พบการประมูล" });
    }

    res.status(200).json({ status: "success", message: "อัปเดต QR Code สำเร็จ", data: auction });
  } catch (error) {
    console.error("❌ Error updating QR Code:", error);
    res.status(500).json({ status: "error", message: "ไม่สามารถอัปเดต QR Code ได้" });
  }
};


// 📌 รันตรวจสอบทุกๆ 5 นาที
setInterval(checkPaymentsAutomatically, 5 * 60 * 1000);