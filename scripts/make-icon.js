const fs = require("fs");
const path = require("path");
const pngToIco = require("png-to-ico");

const png = path.join(__dirname, "..", "assets", "icon.png");
const ico = path.join(__dirname, "..", "assets", "icon.ico");

pngToIco(png)
  .then((buf) => {
    fs.writeFileSync(ico, buf);
    console.log("Icone gerado:", ico);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
