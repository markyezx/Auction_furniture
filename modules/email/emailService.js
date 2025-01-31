require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USERNAME, // ✅ ใช้ค่าจาก .env
    pass: process.env.MAIL_PASSWORD, // ✅ ใช้ค่าจาก .env
  },
});

// 📧 ส่งอีเมลแจ้งผู้ชนะ
exports.sendWinnerEmail = async (winnerEmail, auctionName, finalPrice) => {
  const mailOptions = {
    from: process.env.MAIL_USERNAME, // ✅ ใช้ค่าจาก .env
    to: winnerEmail,
    subject: `🏆 คุณชนะการประมูล ${auctionName}!`,
    text: `ยินดีด้วย! คุณเป็นผู้ชนะการประมูล "${auctionName}" ด้วยราคาสุดท้าย ${finalPrice} บาท 🎉`,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log(`📧 อีเมลแจ้งผู้ชนะถูกส่งไปที่ ${winnerEmail} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error("❌ ไม่สามารถส่งอีเมลแจ้งผู้ชนะได้:", error);
  }
};

// 📧 ส่งอีเมลแจ้งเจ้าของ
exports.sendOwnerEmail = async (ownerEmail, auctionName, winnerName, finalPrice) => {
  const mailOptions = {
    from: process.env.MAIL_USERNAME, // ✅ ใช้ค่าจาก .env
    to: ownerEmail,
    subject: `🔔 การประมูล ${auctionName} สิ้นสุดแล้ว`,
    text: `🎉 การประมูล "${auctionName}" สิ้นสุดแล้ว!\n\nผู้ชนะ: ${winnerName}\nราคาสุดท้าย: ${finalPrice} บาท\n\nขอบคุณที่ใช้บริการ!`,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log(`📧 อีเมลแจ้งเจ้าของถูกส่งไปที่ ${ownerEmail} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error("❌ ไม่สามารถส่งอีเมลแจ้งเจ้าของได้:", error);
  }
};
