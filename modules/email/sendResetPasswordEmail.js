const nodemailer = require("nodemailer");

const sendEmail = async (email, subject, text) => {
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

    transporter.verify(function (error, success) {
      if (error) {
        console.log(error);
      } else {
        console.log("Server is ready to take our messages");
      }
    });

    let html = `<!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>การรีเซ็ตรหัสผ่านระบบประมูล</title>
          <style>
            @media only screen and (max-width: 620px) {
              table.body h1 {
                font-size: 28px !important;
                margin-bottom: 10px !important;
              }

              table.body p,
              table.body ul,
              table.body ol,
              table.body td,
              table.body span,
              table.body a {
                font-size: 16px !important;
              }

              table.body .wrapper,
              table.body .article {
                padding: 10px !important;
              }

              table.body .content {
                padding: 0 !important;
              }

              table.body .container {
                padding: 0 !important;
                width: 100% !important;
              }

              table.body .main {
                border-left-width: 0 !important;
                border-radius: 0 !important;
                border-right-width: 0 !important;
              }

              table.body .btn table {
                width: 100% !important;
              }

              table.body .btn a {
                width: 100% !important;
              }

              table.body .img-responsive {
                height: auto !important;
                max-width: 100% !important;
                width: auto !important;
              }
            }
          </style>
        </head>
        <body style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="background-color: #f6f6f6; width: 100%;" width="100%" bgcolor="#f6f6f6">
            <tr>
              <td></td>
              <td class="container" style="max-width: 580px; padding: 10px; margin: 0 auto;" width="580">
                <div class="content" style="max-width: 580px; padding: 20px; background: #ffffff; border-radius: 3px;">
                  <table role="presentation" class="main" style="width: 100%;" width="100%">
                    <tr>
                      <td class="wrapper" style="padding: 20px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                          <tr>
                            <td>
                              <p>สวัสดีคุณ ${email},</p>
                              <p>คุณได้ทำการขอรีเซ็ตรหัสผ่านสำหรับบัญชีในระบบ <b>Auction</b></p>
                              <p>ข้อมูลการเข้าสู่ระบบใหม่ของคุณมีดังนี้:</p>
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="width: 100%;" width="100%">
                                <tbody>
                                  <tr>
                                    <td>
                                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: auto;">
                                        <tbody>
                                          <tr>
                                            <td>Email: ${email}</td>
                                          </tr>
                                          <tr>
                                            <td>Password: ${text}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              <p>หากคุณไม่ได้ทำการขอรีเซ็ตรหัสผ่าน โปรดติดต่อทีมงานเพื่อแก้ไขปัญหาโดยด่วน</p>
                              <p>ขอแสดงความนับถือ,</p>
                              <p><b>ทีมงาน Auction</b></p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
              <td></td>
            </tr>
          </table>
        </body>
      </html>`;

    const mailOptions = {
      from: `ทีมงาน Auction <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: subject,
      text: `คุณได้ทำการขอรีเซ็ตรหัสผ่านในระบบ Auction กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ที่ระบุด้านล่าง:\nEmail: ${email}\nPassword: ${text}`,
      html: html,
    };

    await transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        res.status(400).send({ message: "เกิดข้อผิดพลาดในการส่งอีเมล", error: error });
      } else {
        console.log("Email sent: " + info.response);
        res.status(200).send({ message: "ส่งอีเมลสำเร็จแล้ว" });
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "เกิดข้อผิดพลาดในการส่งอีเมล", error: error });
  }
};

module.exports = sendEmail;
