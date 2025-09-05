const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Backend is working!" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
