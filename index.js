const config = require("./config/config.json");
const state = require("./state/state.json");

const { sendMail } = require("./mailer");

const {
  logger, //
  shouldShuffle,
  saveState,
  createBackup,
  restoreBackup,
  normalizeAddresses,
  getForgersList
} = require("./helpers");

const {
  setForging,
  getRandomForger,
  getValidApi,
  fetchMissedBlocks,
  fetchForgingQueue,
  ensureForgingStatus,
  preventDoubleForging
} = require("./utils");

const main = async () => {
  logger("Starting script..", "INF");

  createBackup();

  /* Get the list of forgers from the config or an external file */
  const forgersList = await getForgersList().catch(err => {
    logger("Could not fetch list of forgers, exiting now", "ERR");
    process.exit();
  });

  if (!forgersList.length) {
    logger("List of forgers is empty, exiting now", "ERR");
    process.exit();
  }

  logger(`${forgersList.length} total forgers found`, "INF");

  /* Remove trailing forward slashes from all IPs */
  const { apis, forgers } = normalizeAddresses(config.apis, forgersList);

  /* Get last used node and timestamp from the state file */
  const { node: prevForger, ts, init } = state;

  const api = await getValidApi(apis);

  /* Detect if the configured delegate missed a block and act accordingly */
  const missedBlocks = await fetchMissedBlocks(api, config.publicKey);
  if (config.missedBlocks !== null && missedBlocks > config.missedBlocks) {
    logger("Your delegate has missed a block!", "ERR");

    if (config.useMailer) {
      await sendMail({ type: "BLOCK ALERT" })
        .then(() => logger("Alert mail sent!", "INF"))
        .catch(() => logger("Could not send mail!", "ERR"));
    }

    // Do additional stuff here
  }

  /* Analyze if a shuffle is required by validating the forging status of the node  */
  let forceShuffle = init ? true : await ensureForgingStatus(prevForger);

  if (!init) await preventDoubleForging(prevForger, forgers);

  if (forceShuffle || shouldShuffle(ts, config.shuffleInterval)) {
    if (!api) {
      if (config.useMailer) {
        await sendMail({ type: "API WARNING" })
          .then(() => logger("Warning mail sent!", "INF"))
          .catch(() => logger("Could not send mail!", "ERR"));
      }

      logger("No APIs available, exiting now", "ERR");
      process.exit();
    }

    const queue = !forceShuffle ? await fetchForgingQueue(api, config.publicKey) : null;

    if (forceShuffle || queue > config.minimumQueue) {
      logger("Shuffling..", "INF");

      const newForger = await getRandomForger(prevForger, forgers);

      if (!newForger) {
        if (config.useMailer) {
          await sendMail({ type: "ALERT" })
            .then(() => logger("Alert mail sent!", "INF"))
            .catch(() => logger("Could not send mail!", "ERR"));
        }

        logger("No forgers available, exiting now", "ERR");
        process.exit();
      }

      const newForgerStatus = await setForging(newForger, true);
      const prevForgerStatus = init || forceShuffle ? false : await setForging(prevForger, false);
      const stateSaved = await saveState({
        node: newForger,
        ts: Date.now(),
        init: false,
        missedBlocks
      });

      if (!(newForgerStatus && !prevForgerStatus && stateSaved)) {
        logger("Something went wrong, reverting back to original state..", "ERR");

        await setForging(newForger, false);
        await setForging(prevForger, true);

        restoreBackup();
      } else if (forceShuffle && !init && config.useMailer) {
        await sendMail({ type: "WARNING", nodeA: prevForger, nodeB: newForger })
          .then(() => logger("Warning mail sent!", "INF"))
          .catch(() => logger("Could not send mail!", "ERR"));
      }
    } else {
      logger(`Position ${queue} is too close to forging, skipping shuffle`, "INF");
    }
  } else {
    logger(`Time delta of ${config.shuffleInterval} minutes not reached, skipping shuffle`, "INF");
  }

  logger("Script finished ✓\n", "INF");
};

if (typeof module !== "undefined" && !module.parent) main();
