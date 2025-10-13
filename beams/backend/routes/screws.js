const express = require("express");
const ScrewsController = require("../controllers/screws");

const router = express.Router();

router.get("/", ScrewsController.getAllScrews);
router.post("/", ScrewsController.createScrew);
router.get("/length/:length", ScrewsController.getScrewByLength);
router.get("/:id", ScrewsController.getScrewById);
router.put("/:id", ScrewsController.updateScrew);
router.delete("/:id", ScrewsController.deleteScrew);

module.exports = router;

