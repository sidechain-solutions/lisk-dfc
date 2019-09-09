const fetch = require("node-fetch");
const config = require("./config/config.json");
const AbortController = require("abort-controller");

const { logger, shuffle } = require("./helpers");

const fetchForgingStatus = (node, log = true) => {
  if (log) logger(`Fetching forging status from node ${node}..`, "INF");

  const controller = new AbortController();
  const signal = controller.signal;
  const url = `${node}/api/node/status/forging`;

  const options = {
    method: "GET",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json"
    },
    signal
  };

  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  return fetch(url, options)
    .then(res => res.json())
    .then(json => {
      if (log) logger(`Forging status: ${json.data[0].forging}`, "INF");
      clearTimeout(timeoutId);
      return json.data[0].forging;
    })
    .catch(err => {
      if (log) logger("Error occurred while fetching forging status", "ERR");
    });
};

const fetchMissedBlocks = (api, publicKey) => {
  logger(`Fetching number of missed blocks..`, "INF");
  const url = `${api}/api/delegates?publicKey=${publicKey}`;

  const options = {
    method: "GET",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json"
    }
  };

  return fetch(url, options)
    .then(res => res.json())
    .then(json => json.data[0].missedBlocks)
    .catch(() => {
      logger("Error occurred while fetching missed blocks", "ERR");
    });
};

const fetchForgingQueue = (api, publicKey) => {
  logger(`Fetching forging queue..`, "INF");
  const url = `${api}/api/delegates/forgers?limit=101`;

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
      try {
        const place = json.data.findIndex(q => q.publicKey === publicKey);
        logger(`Position in forging queue: ${place}`, "INF");
        return place;
      } catch {
        throw Error();
      }
    })
    .catch(() => {
      logger("Error occurred while fetching forging queue", "ERR");
    });
};

const fetchConsensus = node => {
  logger(`Checking consensus for node: ${node}`, "INF");
  const options = {
    method: "GET",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json"
    }
  };

  return fetch(`${node}/api/node/status`, options)
    .then(res => res.json())
    .then(json => {
      try {
        logger(`Consensus: ${json.data.consensus}%`, "INF");
        return json.data.consensus;
      } catch {
        throw Error();
      }
    })
    .catch(err => {
      logger(`Consensus: 0%`, "INF");
      return 0;
    });
};

const getRandomForger = async (prevForger, forgers) => {
  logger("Selecting a new random forger..", "INF");

  const availableForgers = shuffle(forgers.filter(node => node !== prevForger));

  let randomEntry = availableForgers.pop();
  let consensus = await fetchConsensus(randomEntry);

  while (consensus < config.minimumConsensus && availableForgers.length > 0) {
    randomEntry = availableForgers.pop();
    consensus = await fetchConsensus(randomEntry);
  }

  if (consensus > config.minimumConsensus) {
    logger(`New forger selected: ${randomEntry}`, "INF");
    return randomEntry;
  } else {
    return 0;
  }
};

const getValidApi = async apis => {
  logger("Selecting API..", "INF");

  const checkIfAlive = node => {
    logger(`Checking ${node}..`, "INF");
    return fetch(`${node}/api/node/status`)
      .then(res => {
        if (res.status === 200) {
          logger(`API is alive`, "INF");
          return true;
        } else {
          throw Error();
        }
      })
      .catch(err => {
        logger(`Invalid response`, "ERR");
        return false;
      });
  };

  let api = apis.shift();
  let isAlive = await checkIfAlive(api);

  while (apis.length > 0 && !isAlive) {
    api = apis.shift();
    isAlive = await checkIfAlive(api);
  }

  if (isAlive) {
    return api;
  } else {
    return null;
  }
};

const setForging = (node, enabled, log = true) => {
  if (log) logger(`Setting forging status on node ${node}..`, "INF");
  const url = `${node}/api/node/status/forging`;

  const options = {
    method: "PUT",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      publicKey: config.publicKey,
      password: config.password,
      forging: enabled
    })
  };

  return fetch(url, options)
    .then(res => {
      if (res.status !== 200) throw Error();
      return res.json();
    })
    .then(json => {
      if (log) logger(`Forging status successfully set to '${enabled}'`, "INF");
      return json.data[0].forging;
    })
    .catch(() => {
      if (log) logger("Error while toggling forging status", "ERR");
      return false;
    });
};

const ensureForgingStatus = async node => {
  logger(`Active forging node: ${node}`, "INF");

  let forgingEnabled = await fetchForgingStatus(node);
  let forceShuffle = false;

  if (!forgingEnabled) {
    let attempts = 0;

    while (!forgingEnabled && attempts < config.maxRetries) {
      attempts += 1;
      forgingEnabled = await setForging(node, true).catch(err => logger(err, "ERR"));
    }
    forceShuffle = attempts === config.maxRetries;
  }

  return forceShuffle;
};

const preventDoubleForging = async (prevForger, forgers) => {
  logger(`Verifying that other nodes are not forging..`, "INF");
  const standByForgers = forgers.filter(forger => forger !== prevForger);

  for (let forger of standByForgers) {
    let forgingEnabled = await fetchForgingStatus(forger);
    if (forgingEnabled) {
      await setForging(forger, false).catch(err => logger(err, "ERR"));
    }
  }
};

module.exports = {
  fetchForgingStatus,
  fetchMissedBlocks,
  setForging,
  getValidApi,
  getRandomForger,
  fetchForgingQueue,
  ensureForgingStatus,
  preventDoubleForging
};
