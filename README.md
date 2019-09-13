# Lisk Dynamic Forging Controller

**Lisk Dynamic Forging Controller (LDFC)** is a controller / monitoring tool with the following features:

- Randomizes the node that your delegate will forge on
- Ensures that you don't miss a block
- Mitigates the chance of having multiple forging services active at the same time
- Auto-corrects potential issues
- Sends alerts via email
- Comes with an additional toolset for manual toggling and verification

_DISCLAIMER: No warranty or guarantee of any kind is provided. Please use at your own risk. Even though a lot measures have been taken to make LDFC as secure as possible, it is impossible to rule out **all** possible (split brain) scenarios. Therefore, as a node operator, it is important to stay diligent and to always keep a close eye on your setup._

## How does it work?

LDFC is meant to work with an array of forger nodes. The larger the amount, the more effective the tool is.

Each time LDFC is run, it will first verify if the current node is still forging. If this is not the case it will attempt to correct it (up to a number of configured times , `maxRetries`).

Afterwards, it will verify that none of the other nodes are also forging, and if required, correct the issue.

Next, it will check if a certain amount of time has passed since the last randomisation (`shuffleInterval`). If so, LDFC will randomly select a node from the list of available `forgers`. This will also be done if the forging state of the current node could not be corrected.

The health of the newly selected node is assessed, and if found to be satisfactory, the forging status of the new node is set to `true`, and the forging status of the current node is set to `false`.

If the health of the newly selected node is unsatisfactory, another node will be selected. When there are no suitable nodes, the script will exit without performing a randomisation.

Whenever an error occurs while changing forging states of the nodes, or when something goes wrong while saving the current info to `state.json`, the previous state will be restored using a backup that was generated on script startup.

## Installation

#### Prerequisites

##### Node Configuration

Each node that you use in the array of forgers must...

1. have the latest version of Lisk Core up and running
2. have configured the correct forging data (`encryptedPassphrase`, `publicKey`, etc)
3. have whitelisted forging access to the IP of the device that will be running LDFC

An example of a `config.json` file of a forging node:

```json
{
  "modules": {
    "chain": {
      "forging": {
        "delegates": [
          {
            "encryptedPassphrase": "yourencryptedpassphrase",
            "publicKey": "yourpublickey"
          }
        ]
      }
    },
    "http_api": {
      "access": {
        "public": false,
        "whiteList": ["127.0.0.1", "whitelist.LDFC.IP.here"]
      },
      "forging": {
        "access": {
          "whiteList": ["127.0.0.1", "whitelist.LDFC.IP.here"]
        }
      }
    }
  }
}
```

This location of this file is the following by default:

Mainnet: `/home/lisk/lisk-main/config.json`  
Testnet: `/home/lisk/lisk-test/config.json`

#### Security

Although it is out of the scope of this project, it is obligitory to highlight the importance of securing your node in other ways as well. For example, change the default SSH port, make sure you're up-to-date with security patches, make use of fail2ban, install other DDOS protection, etc.

#### Installation

Log on to the device that will run the LDFC and download / install it with:

```
git clone https://github.com/Lemii/lisk-dfc
cd lisk-dfc
npm install
```

#### Configuration

Next up, configurate all settings:

```
nano config/config.json
```

```json
{
  "publicKey": "yourpublickey",
  "password": "yourpassword",
  "apis": [
    "https://node01.lisk.io",
    "https://node02.lisk.io",
    "https://node03.lisk.io",
    "https://node04.lisk.io",
    "https://node05.lisk.io",
    "https://node06.lisk.io",
    "https://node07.lisk.io",
    "https://node08.lisk.io"
  ],
  "forgers": [
    "http://node1:8000",
    "http://node2:8000",
    "https://node3.domain.com",
    "https://node4.domain.com"
  ],
  "useExternalForgerList": false,
  "forgersListPath": "",
  "forgersListUrl": "",
  "shuffleInterval": 10,
  "minimumQueue": 33,
  "minimumConsensus": 51,
  "maxRetries": 5,
  "timeout": 1500,
  "useMailer": true
}
```

`publicKey`: The public key of your forging delegate  
`password`: The password that you used to encrypt your passphrase  
`apis`: An array of available APIs that the script will use to get certain data  
`forgers`: An array of nodes that will be used to forge blocks  
`useExternalForgerList`: Set this option to 'true' to use one of more **external** lists of forgers instead of the list in the config, either a local file or a file served statically

> LDFC supports `JSON` lists in the following format: `["http://forger1:7000", "http://forger2:7000", "http://forger3:7000"]`. When enabled, either `forgersListPath` OR `forgersListUrl` is required

`forgersListPath`: The path where the list of forgers is stored. Accepted values are a string, or an array of strings  
`forgersListUrl`: The URL where the list of forgers is stored. Should be hosted statically. Accepted values are a string, or an array of strings  
`shuffleInterval`: The amount of time (in minutes) between each node shuffle  
`minimumQueue`: Determines the minimum position in the forging queue to before performe a shuffle  
`maxRetries`: The amount of attempts before returning an error. Used for re-enabling forging and polling the status of nodes
`timeout`: The number of miliseconds before a request times out (default: 1500). Lower this number if you are using excessive amount of nodes to avoid the execution time of the script exceeding the cron job interval  
`useMailer`: Enable or disable mailing functionality. When enabled, LDFC will send warning and alert mails where applicable

**Do not forget to add the protocol prefix (`http://` or `https://`) as well as the port number (where applicable) for the APIs and forgers in the list(s)!**

---

(OPTIONAL) If you enabled the mailer, you must also configure a mail server:

```
nano config/mailer.json
```

#### Log rotate

Considering the verbosity of the logs, it is recommended to include the `logs/` folder in your log rotate setup

## Usage

#### First run

When running LDFC for the first time, the forging status of all nodes should be `false`.

You can run the script with:

```
npm run start
```

You can verify the statuses by running:

```
npm run check
```

If you prefer to do the first run while one forger is already running, add it to `state/state.json` set `init` to `false`:

```
{
  "node": "http://yourforger:8000",
  "ts": 0,
  "init": false
}
```

#### Scheduling

LDFC is meant to be run repeatedly with a very short time interval. It is recommended to set a cronjob to handle this for you.

The example below installs a cronjob that runs every minute (recommended) and uses the default file locations if the tool has been installed as user `Lisk`:

First open the cron editor:

```
crontab -e
```

Next, add the following line:

```
* * * * * /usr/local/bin/node /home/lisk/lisk-dfc/index.js > /home/lisk/lisk-dfc/logs/cron.log 2>&1
```

Save and close the editor.

#### Verification

Monitor the logs with `tail -f logs/history.log` and verify that everything is running correctly

## Manual Control Toolset

LDFC comes with an additional toolset that allows for manual control of your nodes.

You can check the forging statuses of all of your nodes with:

```
npm run check
```

Also, you can manually toggle the forging status of each node with:

```
npm run toggle
```

## License

Licensed under the MIT license
