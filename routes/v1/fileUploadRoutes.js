const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer();

const fileUploadController = require("../../controllers/fileUploadControllers");

const fileUpload = fileUploadController.fileUpload;
const queryObjectInBucket = fileUploadController.queryObjectInBucket || ((req, res) => {
  res.status(501).send({ status: "error", message: "queryObjectInBucket not implemented" });
});

router.post("/", upload.single("product"), fileUpload);
router.get("/", queryObjectInBucket);

module.exports = router;
