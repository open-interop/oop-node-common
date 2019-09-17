const winston = require("winston");

const info = new winston.transports.Console({
    level: "info",
    handleExceptions: true,
    format: winston.format.combine(
        winston.format(info => {
            if (info[Symbol.for("level")] === "error") {
                info.message = String(info[Symbol.for("message")]);
            }

            return info;
        })(),
        winston.format.timestamp(),
        winston.format.json()
    )
});

const myWinstonOptions = {
    transports: [info],
    exitOnError: true,
};

const logger = new winston.createLogger(myWinstonOptions);

const middleware = function(req, res, next) {
    logger.info(`Recieved request ${req.hostname} from ${req.ip}.`);
    next();
};

logger.middleware = middleware;

module.exports = logger;
