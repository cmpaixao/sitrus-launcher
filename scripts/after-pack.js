const path = require("path");
const rcedit = require("rcedit");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const icon = path.join(context.packager.projectDir, "assets", "icon.ico");
  await rcedit(exe, {
    icon,
    "version-string": {
      CompanyName: "Sitrus",
      FileDescription: "Sitrus Launcher",
      ProductName: "Sitrus Launcher",
      InternalName: "Sitrus Launcher",
      OriginalFilename: "Sitrus Launcher.exe",
    },
  });
};
