const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const redis = require("../app");

const sendVerifyEmail = require("../modules/email/sendVerifyEmail");
const sendResetPasswordEmail = require("../modules/email/sendResetPasswordEmail");

const user = require("../schemas/v1/user.schema");

const changePassword = async (req, res) => {
  try {
    // ตรวจสอบว่ามีข้อมูลใน request body
    if (!req.body || !req.body.password) {
      return res.status(400).send({ status: "error", message: "Password is required." });
    }

    const rawPassword = req.body.password;

    // ตรวจสอบความยาวและความปลอดภัยของรหัสผ่าน
    if (rawPassword.length < 8) {
      return res.status(400).send({
        status: "error",
        message: "Password must be at least 8 characters long.",
      });
    }

    const passwordStrengthRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordStrengthRegex.test(rawPassword)) {
      return res.status(400).send({
        status: "error",
        message:
          "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // ตรวจสอบ userId จาก params และ validate รูปแบบ email
    const userId = req.params.user;
    if (!userId || !/^\S+@\S+\.\S+$/.test(userId)) {
      return res.status(400).send({
        status: "error",
        message: "Invalid user email format.",
      });
    }

    // เข้ารหัสรหัสผ่านก่อนบันทึก
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // ค้นหาและอัปเดตข้อมูลผู้ใช้
    const userData = await user.findOneAndUpdate(
      { "user.email": userId },
      { "user.password": hashedPassword },
      { useFindAndModify: false, new: true }
    );

    if (!userData) {
      return res.status(404).send({
        status: "error",
        message: `Cannot update password. User with email ${userId} not found.`,
      });
    }

    // ตรวจสอบ flag resetPassword ใน Redis และลบออกหากมี
    const resetPasswordFlag = await redis.get(`${userId}-resetPassword`);
    if (resetPasswordFlag) {
      await redis.del(`${userId}-resetPassword`);
    }

    // ตอบกลับผู้ใช้เมื่อเปลี่ยนรหัสผ่านสำเร็จ
    return res.status(200).send({
      authenticated_user: req.user,
      status: "success",
      message: `Password for user ${userId} has been successfully updated.`,
    });
  } catch (err) {
    console.error("Error updating password:", err.message);
    return res.status(500).send({
      status: "error",
      message: `An error occurred while updating the password. Please try again later.`,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    let { email } = req.body; // ✅ รับอีเมลจาก body

    if (!email) {
      return res.status(400).send({ status: "error", message: "Email is required" });
    }

    let findUser = await user.findOne({ "user.email": email });

    if (!findUser) {
      return res.status(404).send({
        status: "error",
        message: "User with that email does not exist. Please make sure the email is correct.",
      });
    }

    // 🔹 สร้างรหัสผ่านชั่วคราวแบบสุ่ม 8 ตัวอักษร
    let length = 8,
      charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      password += charset.charAt(Math.floor(Math.random() * n));
    }

    const newTempPassword = password;
    let hashedPassword = await bcrypt.hash(newTempPassword, 10);

    // 🔹 ส่งอีเมลแจ้งรหัสผ่านใหม่
    await sendResetPasswordEmail(email, "Request To Change Password For Auctions.me", newTempPassword);
    
    // 🔹 อัปเดตรหัสผ่านในฐานข้อมูล
    await user.updateOne({ "user.email": email }, { "user.password": hashedPassword });

    // 🔹 ตั้งค่าใน Redis เพื่อป้องกันรีเซ็ตรหัสผ่านซ้ำ
    redis.set(`${email}-resetPassword`, "true");

    res.status(200).send({ status: "success", message: "New password has been sent to your email address." });

  } catch (err) {
    console.error(err);
    res.status(500).send({ status: "error", message: "Internal Server Error" });
  }
};

const sendEmailVerification = async (req, res) => {
  let email = req.params.email;

  try {
    let findUser = await user.findOne({ "user.email": email });

    if (findUser) {
      let activationToken = crypto.randomBytes(32).toString("hex");
      let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();

      await redis.hSet(
        email,
        {
          token: activationToken,
          ref: refKey,
        },
        { EX: 600 }
      );
      await redis.expire(email, 600);

      const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;

      await sendVerifyEmail(email, "Verify Email For Acutions", link);

      const accessToken = req.headers["authorization"].replace("Bearer ", "");

      await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

      const newAccessToken = jwt.sign(
        { userId: req.user.userId, name: req.user.name, email: req.user.email },
        process.env.JWT_ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
      );

      redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

      await res
        .status(200)
        .send({
          authenticated_user: req.user,
          status: "success",
          message: "Verification E-Mail Sent! Please check your mailbox.",
          token: newAccessToken,
        });

      //.catch(err => res.status(500).send({ message: err.message || 'Some error occurred while registering user.' }));
    } else {
      await res
        .status(404)
        .send({
          status: "error",
          message: "User with that is e-mail does not exist. Please make sure the e-mail is correct.",
        });
    }
  } catch (err) {
    console.error(err);
  }
};

const sendPhoneVerification = async (req, res) => {
  //return res.status(200).send({ status: 'error', message: "test" });

  let phone = req.params.phone;

  if (!phone) {
    return res.status(400).send({ status: "error", message: "Phone number can not be empty!" });
  }

  if (phone.length > 12) {
    return res.status(400).send({ status: "error", message: "Phone number can not be more than 12 digits!" });
  }

  try {
    const config = {
      headers: { Authorization: `Bearer ${process.env.PHONE_API_KEY}` },
    };

    await axios
      .post(
        "https://sms-uat.jaidee.io/api/otp/request",
        {
          to: phone,
        },
        config
      )
      .then(async function (response) {
        const refCode = response.data.data.ref;

        redis.set(phone, refCode);
        await redis.expire(phone, 600);

        const newAccessToken = jwt.sign(
          { userId: req.user.userId, name: req.user.name, email: req.user.email },
          process.env.JWT_ACCESS_TOKEN_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
        );

        redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

        res
          .status(200)
          .send({
            authenticated_user: req.user,
            status: "success",
            message: `OTP has been sent to ${phone} and is valid for 10 minutes. Please kindly check your message.`,
            data: { ref: refCode },
            token: newAccessToken,
          });
      })
      .catch(function (error) {
        console.log(error.data);
        res.status(500).send({ status: "error", message: error.message || "Some error occurred while sending OTP." });
      });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
};


const verifyEmail = async (req, res) => {
  const email = req.query.email;
  const ref = req.query.ref;
  const token = req.query.token;

  if (!email) {
    return res.status(400).send({ status: "error", message: "Email cannot be empty!" });
  }

  if (!ref) {
    return res.status(400).send({ status: "error", message: "Ref Code cannot be empty!" });
  }

  if (!token) {
    return res.status(400).send({ status: "error", message: "Token cannot be empty!" });
  }

  try {
    console.log("------> user.email = ", email);

    // Find the user by email
    const findUser = await user.findOne({ "user.email": email });

    if (!findUser) {
      return res.status(404).send({ status: "error", message: "Code is invalid or expired." });
    }

    // Retrieve activation token from Redis
    const activationToken = await redis.hGetAll(email);

    // Verify token and ref
    if (token !== activationToken.token || ref !== activationToken.ref) {
      return res.status(404).send({ status: "error", message: "Code is invalid or expired." });
    }

    // Update user verification status
    await user.updateOne(
      { "user.email": email },
      {
        "user.activated": true,
        "user.verified.email": true,
        "user.verified.phone": true,
      }
    );

    // Remove token from Redis
    await redis.del(email);

    // Display intermediate page before redirecting to YouTube
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
          }
          h1 {
            color: #4CAF50;
          }
          p {
            font-size: 18px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <h1>การยืนยันอีเมลสำเร็จ!</h1>
        <p>กรุณารอสักครู่ เรากำลังพาคุณไปยังหน้าถัดไป...</p>
        <script>
          setTimeout(() => {
            window.location.href = "https://www.youtube.com/watch?v=M3VGsumz7XA&list=RDM3VGsumz7XA&start_radio=1";
          }, 5000); // 5 วินาที
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error during email verification:", err);
    res.status(500).send({
      status: "error",
      message: err.message || "Some error occurred while trying to verify email.",
    });
  }
};


const verifyPhone = async (req, res) => {
  let email = req.query.email;
  let phone = req.query.phone;
  let otp = req.query.otp;

  if (!email) {
    return res.status(400).send({ status: "error", message: "Email can not be empty!" });
  }

  if (!phone) {
    return res.status(400).send({ status: "error", message: "Phone number can not be empty!" });
  }

  if (phone.length > 12) {
    return res.status(400).send({ status: "error", message: "Phone number can not be more than 12 digits!" });
  }

  if (!otp) {
    return res.status(400).send({ status: "error", message: "Pin Code can not be empty!" });
  }

  if (otp.length !== 6) {
    return res.status(400).send({ status: "error", message: "OTP can not be more than 12 digits!" });
  }

  try {
    let findUser = await user.findOne({ "user.email": email });

    if (!findUser) {
      return res
        .status(404)
        .send({
          status: "error",
          message: "User with that email does not exist. Please make sure the phone number is correct.",
        });
    }

    let refCode = await redis.get(phone);

    if (!refCode) {
      return res.status(404).send({ status: "error", message: "The OTP has expired, please request the OTP again." });
    }

    const config = {
      headers: { Authorization: `Bearer ${process.env.PHONE_API_KEY}` },
    };

    await axios
      .post(
        "https://sms-uat.jaidee.io/api/otp/verify",
        {
          ref: refCode,
          pin: otp,
        },
        config
      )
      .then(async function (response) {
        const responseRefCode = response.data.data.ref;

        if (responseRefCode === refCode) {
          await user.updateOne({ "user.email": email }, { "user.phone": phone, "user.verified.phone": true });
          await redis.del(phone);

          //const accessToken = req.headers["authorization"].replace("Bearer ", "");

          //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

          const newAccessToken = jwt.sign(
            { userId: req.user.userId, name: req.user.name, email: req.user.email },
            process.env.JWT_ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
          );

          redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

          await res
            .status(200)
            .send({
              authenticated_user: req.user,
              status: "success",
              message: "Phone number has been successfully verified!",
              token: newAccessToken,
            });
        } else {
          return res.status(404).send({ status: "error", message: "OTP is either invalid or expired." });
        }
      })
      .catch(function (error) {
        console.log(error.data);
        res.status(500).send({ status: "error", message: error.message || "Some error occurred while sending OTP." });
      });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send({ status: "error", message: err.message || "Some error occurred while trying to verify phone." });
  }
};

const verifyPhoneTemp = async (req, res) => {
  let email = req.query.email;
  let phone = req.query.phone;

  if (!email) {
    return res.status(400).send({ status: "error", message: "Email can not be empty!" });
  }

  if (!phone) {
    return res.status(400).send({ status: "error", message: "Phone number can not be empty!" });
  }

  if (phone.length > 12) {
    return res.status(400).send({ status: "error", message: "Phone number can not be more than 12 digits!" });
  }

  try {
    let findUser = await user.findOne({ "user.email": email });

    if (!findUser) {
      return res
        .status(404)
        .send({
          status: "error",
          message: "User with that email does not exist. Please make sure the phone number is correct.",
        });
    }

    await user.updateOne({ "user.email": email }, { "user.phone": phone, "user.verified.phone": true });
    await redis.del(phone);

    const newAccessToken = jwt.sign(
      { userId: req.user.userId, name: req.user.name, email: req.user.email },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );

    redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

    await res
      .status(200)
      .send({
        authenticated_user: req.user,
        status: "success",
        message: "Phone number has been successfully verified!",
        token: newAccessToken,
      });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send({ status: "error", message: err.message || "Some error occurred while trying to verify phone." });
  }
};

const deactivateAccount = async (req, res) => {
  const userId = req.params.user;

  if (!userId) {
    return res.status(400).send({ status: "error", message: "User cannot be empty!" });
  }

  const findUser = await user.findOne({ $or: [{ userId: userId }, { "user.email": userId }] });

  if (findUser) {
    await user.updateOne({ $or: [{ userId: userId }, { "user.email": userId }] }, { "user.activated": false });

    //const accessToken = req.headers["authorization"].replace("Bearer ", "");

    //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

    const newAccessToken = jwt.sign(
      { userId: req.user.userId, name: req.user.name, email: req.user.email },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );

    redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

    await res
      .status(200)
      .send({
        authenticated_user: req.user,
        status: "success",
        message: `User ${userId} has been deactivated!`,
        token: newAccessToken,
      });
  } else {
    return res.status(404).send({ status: "error", message: `User ${userId} was not found.` });
  }
};

const unverifyEmail = async (req, res) => {
  const userId = req.params.user;

  if (!userId) {
    return res.status(400).send({ status: "error", message: "User cannot be empty!" });
  }

  const findUser = await user.findOne({ $or: [{ userId: userId }, { "user.email": userId }] });

  if (findUser) {
    await user.updateOne({ $or: [{ userId: userId }, { "user.email": userId }] }, { "user.verified.email": false });

    //const accessToken = req.headers["authorization"].replace("Bearer ", "");

    //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

    const newAccessToken = jwt.sign(
      { userId: req.user.userId, name: req.user.name, email: req.user.email },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );

    redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

    await res
      .status(200)
      .send({
        authenticated_user: req.user,
        status: "success",
        message: `User ${userId} email has been unverified!`,
        token: newAccessToken,
      });
  } else {
    return res.status(404).send({ status: "error", message: `User ${userId} was not found.` });
  }
};

const unverifyPhone = async (req, res) => {
  const userId = req.params.user;

  if (!userId) {
    return res.status(400).send({ status: "error", message: "User cannot be empty!" });
  }

  const findUser = await user.findOne({ $or: [{ userId: userId }, { "user.email": userId }] });

  if (findUser) {
    await user.updateOne({ $or: [{ userId: userId }, { "user.email": userId }] }, { "user.verified.phone": false });

    //const accessToken = req.headers["authorization"].replace("Bearer ", "");

    //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

    const newAccessToken = jwt.sign(
      { userId: req.user.userId, name: req.user.name, email: req.user.email },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );

    redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

    await res
      .status(200)
      .send({
        authenticated_user: req.user,
        status: "success",
        message: `User ${userId} phone number has been unverified!`,
        token: newAccessToken,
      });
  } else {
    return res.status(404).send({ status: "error", message: `User ${userId} was not found.` });
  }
};

const verifyRefreshTokenOTP = async (req, res) => {
  let userId = req.body.userId;
  let otp = req.body.otp;

  const foundUser = await user.findOne({ userId: userId });

  const hardwareID = req.headers["hardware-id"];
  const userRefreshToken = req.headers["authorization"].replace("Bearer ", "");
  const lastRefreshToken = await redis.get(`Last_Refresh_Token_${userId}_${hardwareID}`);
  const savedOTP = await redis.get(`Last_Refresh_Token_OTP_${userId}_${hardwareID}`);

  if (foundUser && otp === savedOTP && lastRefreshToken == userRefreshToken) {
    const accessToken = jwt.sign(
      { userId: userId, name: foundUser.user.name, email: foundUser.user.email },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );
    const refreshToken = jwt.sign(
      { userId: userId, name: foundUser.user.name, email: foundUser.user.email },
      process.env.JWT_REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
    );

    //? Add Refresh Token OTP to Redis

    let length = 6,
      charset = "0123456789",
      refreshTokenOTP = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      refreshTokenOTP += charset.charAt(Math.floor(Math.random() * n));
    }

    redis.set(`Last_Refresh_Token_OTP_${userId}_${hardwareID}`, refreshTokenOTP);
    redis.set(`Last_Refresh_Token_${userId}_${hardwareID}`, refreshToken);
    redis.set(`Last_Access_Token_${userId}_${hardwareID}`, accessToken);

    //const usedRefreshToken = req.headers["authorization"].replace("Bearer ", "");

    //await redis.sAdd(`Used_Refresh_Token_${req.user.userId}`, usedRefreshToken);

    //await user.findOneAndUpdate({ userId: userId }, { 'user.token': refreshToken }, { useFindAndModify: false, new: true });

    await res.status(200).send({
      status: "success",
      message: "Refresh Token OTP successfully verified",
      data: {
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          refreshTokenOTP: refreshTokenOTP,
        },
      },
    });
  } else {
    await res.status(406).send({ status: "error", message: "Refresh Token OTP Incorrect!" });
  }
};

const getOneAccount = async (req, res) => {
  const userId = req.params.user;

  try {
    let findUser = await user.findOne({
      $or: [{ userId: userId }, { "user.email": userId }],
    });

    if (findUser) {
      //const accessToken = req.headers["authorization"].replace("Bearer ", "");

      //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

      const newAccessToken = jwt.sign(
        { userId: req.user.userId, name: req.user.name, email: req.user.email },
        process.env.JWT_ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
      );
      redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

      await res
        .status(200)
        .send({
          authenticated_user: req.user,
          status: "success",
          message: `User ID ${userId} was found.`,
          data: findUser,
          token: newAccessToken,
        });
    } else {
      await res.status(404).send({ status: "error", message: `User ID ${userId} was not found.` });
    }
  } catch (err) {
    await res.status(500).send({ status: "error", message: err.message || `Error retrieving user ID ${userId}` });
  }
};

const getAllAccounts = async (req, res) => {
  let allUsers = await user.find();
  let allUsersCount = await user.count();

  //const accessToken = req.headers["authorization"].replace("Bearer ", "");

  //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

  const newAccessToken = jwt.sign(
    { userId: req.user.userId, name: req.user.name, email: req.user.email },
    process.env.JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
  );
  redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

  await res
    .status(200)
    .json({
      authenticated_user: req.user,
      status: "success",
      data: { count: allUsersCount, users: allUsers },
      token: newAccessToken,
    });
};

const deleteOneAccount = async (req, res) => {
  if (!req.body) {
    res.status(400).send({ status: "error", message: "Content can not be empty!" });
    return;
  }

  const userId = req.params.user;
  await redis.del(`${userId}-resetPassword`);

  user
    .findOneAndRemove({
      $or: [{ userId: userId }, { "user.email": userId }],
    })
    .then(async (data) => {
      if (!data) {
        res
          .status(404)
          .send({ status: "error", message: `Cannot delete user ID ${userId}. Maybe user was not found.` });
      } else {
        const newAccessToken = jwt.sign(
          { userId: req.user.userId, name: req.user.name, email: req.user.email },
          process.env.JWT_ACCESS_TOKEN_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
        );
        await res
          .status(200)
          .send({
            authenticated_user: req.user,
            status: "success",
            message: `User ID ${userId} was deleted successfully.`,
            token: newAccessToken,
          });
      }
    })
    .catch((err) => {
      res.status(500).send({ status: "error", message: `Could not delete User ID ${userId}` });
    });
};

const deleteAllAccounts = async (req, res) => {
  user
    .deleteMany({})
    .then(async (data) => {
      //const accessToken = req.headers["authorization"].replace("Bearer ", "");

      //await redis.sAdd(`Used_Access_Token_${req.user.userId}`, accessToken);

      const newAccessToken = jwt.sign(
        { userId: req.user.userId, name: req.user.name, email: req.user.email },
        process.env.JWT_ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
      );
      redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

      await res
        .status(200)
        .send({
          authenticated_user: req.user,
          status: "success",
          message: `${data.deletedCount} Users were deleted successfully!`,
          token: newAccessToken,
        });
    })
    .catch((err) => {
      res.status(500).send({
        status: "error",
        message: err.message || "Some error occurred while removing all users",
      });
    });
};

const updateBusinessesByUserId = async (req, res) => {
  const { businessId, userId, newUserId } = req.body;
  //await res.status(200).send({ authenticated_user: req.user, status: 'success', message: 'success' })
  if (!userId) {
    return res.status(400).send({ status: "error", message: "userId can not be empty!" });
  }

  if (!businessId) {
    return res.status(400).send({ status: "error", message: "Businessd can not be empty!" });
  }

  // if (!newUserId) {
  //    newUserId = userId;
  // }

  try {
    const businessKey = { [businessId]: "owner" };

    const updatedUser = await user.findOneAndUpdate(
      { userId: userId },
      { userId: newUserId, "user.businesses": [businessKey] },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(401).send({ status: "error", message: "User can not be updated!" });
    }

    const newAccessToken = jwt.sign(
      { userId: req.user.userId, name: req.user.name, email: req.user.email },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );
    redis.set(`Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`, newAccessToken);

    await res
      .status(200)
      .send({
        authenticated_user: req.user,
        status: "success",
        message: "Users were updated successfully!",
        data: updatedUser,
        token: newAccessToken,
      });
  } catch (error) {
    console.error("Error updating businesses:", error);
    throw error;
  }
};

module.exports = {
  changePassword,
  resetPassword,
  sendEmailVerification,
  sendPhoneVerification,
  verifyEmail,
  verifyPhone,
  verifyPhoneTemp,
  deactivateAccount,
  unverifyEmail,
  unverifyPhone,
  verifyRefreshTokenOTP,
  getOneAccount,
  getAllAccounts,
  deleteOneAccount,
  deleteAllAccounts,
  updateBusinessesByUserId,
};
