const nodemailer = require("nodemailer");

const sendWinnerEmail = async (email, auctionName, finalPrice) => {
  try {
    console.log(`📧 กำลังเตรียมส่งอีเมลถึง: ${email}`);

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true, // ใช้ SSL/TLS
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    // ตรวจสอบ SMTP ก่อนส่งอีเมล
    try {
      await transporter.verify();
      console.log("✅ SMTP พร้อมทำงาน");
    } catch (smtpError) {
      console.error("❌ SMTP Error:", smtpError);
      return { status: "error", message: "SMTP connection failed", error: smtpError };
    }

    const mailOptions = {
      from: `"Auction System" <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: "🎉 [แจ้งเตือน] คุณชนะการประมูลแล้ว!",
      text: `คุณคือผู้ชนะการประมูล "${auctionName}" ด้วยราคาสุดท้าย ${finalPrice} บาท\nกรุณาติดต่อผู้ขายเพื่อดำเนินการชำระเงิน`,
      html: `
        <h1 style="color: #2c3e50;">🎉 คุณคือผู้ชนะการประมูล! 🎉</h1>
        <p>คุณเป็นผู้ชนะในการประมูล <strong>${auctionName}</strong></p>
        <p style="font-size: 18px;">💰 ราคาปิด: <strong>${finalPrice} บาท</strong></p>
        <p>กรุณาติดต่อผู้ขายเพื่อดำเนินการชำระเงิน</p>
        <hr>
        <p>ขอบคุณที่ใช้บริการ!</p>
      `,
    };

    console.log("📧 กำลังส่งอีเมล...");
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ อีเมลถูกส่งไปยัง: ${email}, Response: ${info.response}`);

    return { status: "success", message: "Email sent successfully", info };

  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { status: "error", message: "Failed to send email", error };
  }
};

module.exports = sendWinnerEmail;
