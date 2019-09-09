const { fetchForgingStatus } = require("../utils");

const config = require("../config/config.json");

const main = async () => {
  console.log("Checking all forger statuses..");

  const forgers = config.forgers;

  for (let node of forgers) {
    const status = await fetchForgingStatus(node, false);
    console.log(node, status);
  }

  console.log("Finished checking all forger statuses ✓");
};

if (typeof module !== "undefined" && !module.parent) main();
