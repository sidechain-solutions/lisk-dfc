const mailConfig = require("./config/mailer.json");
const nodemailer = require("nodemailer");

const sendMail = mailQuery => {
  const { host, port, secure, auth, recipient } = mailConfig;
  const { type, nodeA, nodeB } = mailQuery;

  let transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth
  });

  const messages = {
    "API WARNING": `No APIs were available. Node randomisation has been skipped. Please investigate.`,
    "BLOCK ALERT": `Your delegate has missed a block! Please investigate immediately!`,
    WARNING: `${nodeA} was not reachable! Forging switched over to ${nodeB}. Please investigate.`,
    ALERT: `None of the forgers could be reached! Please investigate immediately!`
  };

  return transporter.sendMail({
    from: auth.user,
    to: recipient,
    subject: `LDFC ${type}!`,
    text: messages[type]
  });
};

module.exports = { sendMail };
