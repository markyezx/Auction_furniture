const Joi = require("joi");
const jwt = require("jsonwebtoken");

// === Header Schema ===
const headerSchema = Joi.object({
  "device-fingerprint": Joi.string().required().messages({
    "any.required": "Device fingerprint is required!",
    "string.base": "Device fingerprint must be a string!",
  }),
  businessid: Joi.string().required().messages({
    "any.required": "Business ID is required!",
    "string.base": "Business ID must be a string!",
  }),
}).unknown(true);

// === Body Schema ===
const bodySchema = Joi.object({
  email: Joi.string().email().required().messages({
    "any.required": "Email is required!",
    "string.email": "Invalid email format!",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required!",
    "string.base": "Password must be a string!",
  }),
});

// === Middleware สำหรับ validate Headers ===
const validateHeaders = (req, res, next) => {
  const { error } = headerSchema.validate(req.headers);
  if (error) {
    return res.status(400).send({ status: "error", message: error.message });
  }
  next();
};

// === Middleware สำหรับ validate Body ===
const validateBody = (req, res, next) => {
  const { error } = bodySchema.validate(req.body);
  if (error) {
    return res.status(400).send({ status: "error", message: error.message });
  }
  next();
};

// === ฟังก์ชันสำหรับ Generate JWT Token ===
const generateToken = (payload, secret, expiresIn) =>
  jwt.sign(payload, secret, { expiresIn });

// === Export Schemas และ Middleware ===
module.exports = {
  validateHeaders,
  validateBody,
  generateToken,
};
