const express = require("express");
const WoodsController = require("../controllers/woods");

const router = express.Router();

router.get("/", WoodsController.getAllWoods);

module.exports = router;

