const winston = require("winston");

const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});
const myWinstonOptions = {
    transports: [consoleTransport]
};

const logger = new winston.createLogger(myWinstonOptions);

const middleware = function(req, res, next) {
    logger.info(`Recieved request ${req.hostname} from ${req.ip}.`);
    next();
};

logger.middleware = middleware;

module.exports = logger;
