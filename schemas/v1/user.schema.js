// schemas/user.schema.js
const mongoose = require("mongoose");
const addressSchema = require("./address.schema");
const contactInfoSchema = require("./contact.schema");

const UserSchema = new mongoose.Schema(
  {
    user: {
      name: { type: String, required: true },
      username: { type: String, trim: true },
      email: {
        type: String,
        required: true,
        unique: true,
        match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
      },
      phone: { type: String, trim: true },
      password: { type: String, required: true },
      token: { type: String },
      activated: { type: Boolean, default: false },
      verified: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
      },
    },
    lang: {
      type: String,
      default: "TH",
      enum: ["EN", "TH"], // จำกัดค่าให้เลือกได้เฉพาะภาษา EN/TH
    },
    deviceFingerPrint: [
      {
        deviceType: { type: String, required: true },
        fingerPrint: { type: String, required: true },
      },
    ],
    groups: [
      {
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
        roleInGroup: { type: String, enum: ["member", "admin", "owner"] },
        statusInGroup: { type: String, default: "active" },
      },
    ],
    chatGroups: [
      {
        chatGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatGroup" },
        roleInChatGroup: { type: String, enum: ["member", "admin"] },
        statusInChatGroup: { type: String, default: "active" },
      },
    ],
    userType: {
      type: String,
      required: true,
      enum: ["regular", "organization", "sponsor"],
    },
    userData: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userTypeData",
    },
    userTypeData: {
      type: String,
      required: true,
      enum: ["RegularUserData", "OrganizationUserData"],
    },
    businessId: { type: String },
    loggedInDevices: [
      {
        deviceFingerprint: { type: String, required: true },
        lastLogin: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// ตรวจสอบก่อนบันทึกว่าฟิลด์อีเมลต้องไม่ซ้ำกัน
UserSchema.pre("save", async function (next) {
  if (!this.isModified("email")) return next();
  const existingUser = await mongoose.models.User.findOne({ email: this.user.email });
  if (existingUser) {
    const error = new Error("Email already exists");
    error.status = 409;
    return next(error);
  }
  next();
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
