const express = require("express");
const ProductController = require("../controllers/products");

const router = express.Router();

router.get("/", ProductController.getAllProducts);
router.post("/save-changes", ProductController.saveChanges);
router.post("/delete-configuration", ProductController.deleteConfiguration);
router.get("/name/:name", ProductController.getProductByName);
router.get("/:id", ProductController.getProductById);

module.exports = router;





