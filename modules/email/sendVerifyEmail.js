const nodemailer = require('nodemailer');

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
            logger: true,
        });

        transporter.verify((error, success) => {
            if (error) {
                console.error('Transporter Verification Error:', error);
            }
        });

        // Updated HTML template for auction system
        const html = `
            <!doctype html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <title>กรุณายืนยันอีเมลของคุณ</title>
                <style>
                  @media only screen and (max-width: 620px) {
                    table.body h1 {
                      font-size: 28px !important;
                      margin-bottom: 10px !important;
                    }
                    table.body p,
                    table.body a {
                      font-size: 16px !important;
                    }
                    .btn-primary a {
                      width: 100% !important;
                    }
                  }
                  .btn-primary a:hover {
                    background-color: #28a745 !important;
                    border-color: #28a745 !important;
                  }
                </style>
              </head>
              <body style="background-color: #f6f6f6; font-family: sans-serif; font-size: 14px; line-height: 1.4; margin: 0; padding: 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="width: 100%; background-color: #f6f6f6;">
                  <tr>
                    <td></td>
                    <td class="container" style="max-width: 580px; padding: 10px; margin: 0 auto;">
                      <div class="content" style="max-width: 580px; padding: 10px; background: #ffffff; border-radius: 3px;">
                        <table role="presentation" class="main" style="width: 100%;">
                          <tr>
                            <td class="wrapper" style="padding: 20px;">
                              <p>สวัสดีคุณ ${email},</p>
                              <p>ยินดีต้อนรับสู่ <strong>ระบบประมูลออนไลน์</strong></p>
                              <p>กรุณายืนยันอีเมลของคุณโดยคลิกที่ปุ่มด้านล่างภายใน <strong>10 นาที</strong> เพื่อเปิดใช้งานบัญชีของคุณ:</p>
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                                <tbody>
                                  <tr>
                                    <td align="center">
                                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                        <tr>
                                          <td> <a href="${text}" target="_blank" style="padding: 12px 25px; text-decoration: none; background-color: #007bff; color: #ffffff; border-radius: 5px;">ยืนยันอีเมล</a> </td>
                                        </tr>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              <p>หากคุณไม่ได้ลงทะเบียน กรุณาละเว้นอีเมลนี้</p>
                              <p><strong>ทีมงานระบบประมูลออนไลน์</strong></p>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </table>
              </body>
            </html>
        `;

        const mailOptions = {
            from: `Auction System Support <${process.env.MAIL_USERNAME}>`,
            to: email,
            subject: subject,
            text: text,
            html: html,
        };

        // Send email
        await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return { status: 'error', message: 'Error sending email', error };
            } else {
                console.log('Email sent:', info.response);
                return { status: 'success', message: 'Mail Successfully Sent' };
            }
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        return { status: 'error', message: 'Unexpected error occurred', error };
    }
};

module.exports = sendEmail;
