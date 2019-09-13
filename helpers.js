const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const config = require("./config/config.json");

const stream = fs.createWriteStream(path.resolve(__dirname, "logs", "history.log"), { flags: "a" });

const logger = (message, type) => {
  const logEntry = `${new Date().toISOString()}   ${type}   ${message}`;
  console.log(logEntry);
  stream.write(logEntry + "\n");
};

const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getForgersList = async () => {
  logger(`Fetching list of forgers..`, "INF");

  const forgers = [];

  if (!config.useExternalForgerList && config.forgers.length) {
    logger(`Reading config file.. ${config.forgersListPath}`, "INF");
    config.forgers.forEach(ip => forgers.push(ip));
    logger(`${config.forgers.length} forgers in list`, "INF");
  }

  /* FETCH FILES */
  if (config.useExternalForgerList && config.forgersListPath.length) {
    if (typeof config.forgersListPath === "string") {
      logger(`Reading file: ${config.forgersListPath}`, "INF");
      require(config.forgersListPath).forEach(ip => forgers.push(ip));
      return forgers;
    } else if (typeof config.forgersListPath === "object") {
      for (let i = 0; i < config.forgersListPath.length; i++) {
        const path = config.forgersListPath[i];
        logger(`Reading file: ${path}`, "INF");

        try {
          require(path).forEach(ip => forgers.push(ip));
          logger(`${path.length} forgers in list`, "INF");
        } catch {
          logger(`Could not read file!`, "ERR");
        }

        if (i === config.forgersListPath.length - 1) return forgers;
      }
    }
    /* FETCH URLS */
  } else if (config.useExternalForgerList && config.forgersListUrl.length) {
    const fetchAndProcessUrl = url => {
      const options = {
        method: "GET",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json"
        }
      };

      return fetch(url, options)
        .then(res => res.json())
        .then(json => {
          logger(`${json.length} forgers in list`, "INF");
          json.forEach(ip => forgers.push(ip));
        })
        .catch(err => logger(`Could not read file!`, "ERR"));
    };

    if (typeof config.forgersListUrl === "string") {
      logger(`Reading file: ${config.forgersListUrl}`, "INF");
      await fetchAndProcessUrl(config.forgersListUrl);
      return forgers;
    } else if (typeof config.forgersListUrl === "object") {
      for (let list of config.forgersListUrl) {
        logger(`Reading file: ${list}`, "INF");
        await fetchAndProcessUrl(list);
      }
      return forgers;
    }
  }

  return forgers;
};

const saveState = data => {
  const filePath = path.resolve(__dirname, "state", "state.json");

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
      if (err) {
        logger("Error saving file", "ERR");
        reject(false);
      }
      logger(`State saved in ${filePath}`, "INF");
      resolve(true);
    });
  });
};

const createBackup = () => {
  logger(`Creating backup of state..`, "INF");
  fs.copyFileSync(
    path.resolve(__dirname, "state", "state.json"),
    path.resolve(__dirname, "state", "state_backup.json")
  );
  logger(`Backup successfully created`, "INF");
};

const restoreBackup = () => {
  logger(`Restoring backup of state..`, "INF");
  fs.copyFileSync(
    path.resolve(__dirname, "state", "state_backup.json"),
    path.resolve(__dirname, "state", "state.json")
  );
  logger(`Backup successfully restored`, "INF");
};

const shouldShuffle = (previousShuffle, shuffleInterval) => {
  const intervalTs = shuffleInterval * 60000;
  const delta = Date.now() - previousShuffle;

  logger(`Last node shuffle was ${Math.floor(delta / 60000)} minutes ago`, "INF");

  return delta > intervalTs;
};

const normalizeAddresses = (apis, forgers) => ({
  apis: apis.map(api => api.replace(/\/+$/, "")),
  forgers: forgers.map(forger => forger.replace(/\/+$/, ""))
});

module.exports = {
  logger,
  getForgersList,
  shuffle,
  shouldShuffle,
  saveState,
  createBackup,
  restoreBackup,
  normalizeAddresses
};
