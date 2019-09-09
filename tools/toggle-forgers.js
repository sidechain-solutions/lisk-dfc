const { setForging } = require("../utils");
const readlineSync = require("readline-sync");

const config = require("../config/config.json");

const exit = () => {
  console.log("Exiting now..");
  process.exit();
};

const main = async () => {
  const index = readlineSync.keyInSelect(config.forgers, "Which forger?");
  const forger = config.forgers[index];
  if (index === -1) exit();

  console.log(`Forger selected: ${forger}`);

  const options = ["Enable", "Disable"];
  const status = readlineSync.keyInSelect(options, "Enable or disable forging?");
  if (status === -1) exit();

  console.log(`Status selected: ${options[status]}`);

  const statusBool = options[status] === "Enable";
  const nodeStatus = await setForging(forger, statusBool, false);

  console.log(`Forging status successfully set to '${nodeStatus}' ✔`);
};

if (typeof module !== "undefined" && !module.parent) main();
