const express = require("express");
const ProductController = require("../controllers/products");

const router = express.Router();

router.get("/", ProductController.getAllProducts);
router.post("/", ProductController.createProduct);
router.delete("/:id", ProductController.deleteProduct);
router.get("/name/:name", ProductController.getProductByName);
router.get("/:id", ProductController.getProductById);

module.exports = router;





