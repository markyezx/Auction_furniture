const bcrypt = require("bcrypt");
const crypto = require("crypto");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const redis = require("../../app");
const sendEmail = require("../../modules/email/sendVerifyEmail");
const User = require("../../schemas/v1/user.schema");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true,
      session: false,
    },
    async (req, email, password, cb) => {
      try {
        const businessId = req.headers["businessid"];
        if (!businessId) {
          console.log("400 : Business ID is required!");
          return cb(null, false, {
            statusCode: 400,
            message: "Business ID is required!",
          });
        }

        // ✅ ดึง `password` ด้วย `.select("+user.password")`
        const existingUser = await User.findOne({
          "user.email": email,
          businessId: businessId,
        }).select("+user.password");

        if (!existingUser) {
          console.log("404 : User not found.");
          return cb(null, false, {
            statusCode: 404,
            message: "User not found.",
          });
        }

        if (!existingUser.user.password) {
          console.log("403 : Incorrect credentials (1)");
          return cb(null, false, {
            statusCode: 403,
            message: "Incorrect credentials.",
          });
        }

        const isMatch = await bcrypt.compare(password, existingUser.user.password);
        if (!isMatch) {
          console.log("403 : Incorrect credentials (2)");
          return cb(null, false, {
            statusCode: 403,
            message: "Incorrect credentials.",
          });
        }

        if (existingUser.user.activated === false) {
          let activationToken = crypto.randomBytes(32).toString("hex");
          let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();

          await redis.hSet(email, { token: activationToken, ref: refKey }, { EX: 600 });
          await redis.expire(email, 600);

          const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;
          console.log("🔗 Activation Link:", link);
          await sendEmail(email, "Verify Email For JaideePOS", link);

          console.log("406 : Email has not been activated.");
          return cb(null, false, {
            statusCode: 406,
            message: "Email not activated. Verification email has been sent.",
          });
        }

        let checkResetPassword = await redis.get(`${email}-resetPassword`);
        if (checkResetPassword) {
          return cb(null, false, {
            statusCode: 200,
            message: "Please change your password.",
          });
        }

        return cb(null, existingUser);
      } catch (error) {
        console.error("❌ Error in passport-local authentication:", error);
        return cb(error);
      }
    }
  )
);
