const express = require("express");
const OrdersController = require("../controllers/orders");

const router = express.Router();

router.get("/numofpendingorders/:userId", OrdersController.getNumOfPendingOrders);

module.exports = router;
