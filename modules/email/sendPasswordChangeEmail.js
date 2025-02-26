const nodemailer = require("nodemailer");

const sendPasswordChangeEmail = async (email, userName) => {
  try {
    console.log(`📧 กำลังเตรียมส่งอีเมลแจ้งเตือนการเปลี่ยนรหัสผ่านถึง: ${email}`);

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
      from: `"Security Team" <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: "🔒 การเปลี่ยนรหัสผ่านของคุณ",
      text: `สวัสดี ${userName},\n\nรหัสผ่านของคุณถูกเปลี่ยนสำเร็จ\nหากคุณไม่ได้เป็นคนทำการเปลี่ยน โปรดรีเซ็ตรหัสผ่านของคุณทันที`,
      html: `
        <h2 style="color: #2c3e50;">🔒 การเปลี่ยนรหัสผ่านของคุณ</h2>
        <p>สวัสดี <strong>${userName}</strong>,</p>
        <p>รหัสผ่านของคุณถูกเปลี่ยนสำเร็จ</p>
        <p style="color: red;"><strong>หากคุณไม่ได้เป็นคนเปลี่ยนรหัสผ่าน กรุณารีเซ็ตรหัสผ่านของคุณทันที!</strong></p>
        <hr>
        <p>ขอบคุณที่ใช้บริการ!</p>
      `,
    };

    console.log("📧 กำลังส่งอีเมล...");
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ อีเมลแจ้งเตือนถูกส่งไปยัง: ${email}, Response: ${info.response}`);

    return { status: "success", message: "Email sent successfully", info };

  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { status: "error", message: "Failed to send email", error };
  }
};

module.exports = sendPasswordChangeEmail ;
