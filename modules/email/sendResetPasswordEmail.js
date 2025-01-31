const nodemailer = require("nodemailer");

const sendResetPasswordEmail = async (email, subject, resetToken) => {
  const resetLink = `http://localhost:3000/resetpassword?token=${resetToken}`;


  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    let html = `<!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>รีเซ็ตรหัสผ่าน</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f6f6f6;
              padding: 20px;
              text-align: center;
            }
            .email-container {
              max-width: 600px;
              margin: auto;
              background: #ffffff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .btn {
              background-color: #007bff;
              color: white;
              padding: 12px 20px;
              text-decoration: none;
              font-size: 16px;
              border-radius: 5px;
              display: inline-block;
              margin-top: 10px;
            }
            .btn:hover {
              background-color: #0056b3;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #888;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <h2>รีเซ็ตรหัสผ่านของคุณ</h2>
            <p>คุณได้ทำการขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณในระบบ <b>Auction</b></p>
            <p>กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
            <a href="${resetLink}" class="btn" target="_blank">รีเซ็ตรหัสผ่าน</a>
            <p class="footer">ลิงก์นี้จะหมดอายุใน 15 นาที</p>
            <p class="footer">หากคุณไม่ได้ร้องขอ โปรดเพิกเฉยต่ออีเมลนี้</p>
          </div>
        </body>
      </html>`;

    const mailOptions = {
      from: `ทีมงาน Auction <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: subject,
      text: `กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: ${resetLink}`,
      html: html,
    };

    await transporter.sendMail(mailOptions);
    console.log("Reset password email sent to:", email);
  } catch (error) {
    console.error("Error sending reset password email:", error);
  }
};

module.exports = sendResetPasswordEmail;
