const winston = require("winston");

const options = {
    transports: [new winston.transports.Console()],
    level: "debug",
    exitOnError: true,
    handleExceptions: true,
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(function(info) {
            var m = `${info.level}:[${info.timestamp}]: ${info.message}`;

            if (typeof info.stack !== "undefined") {
                m +=
                    "\n=============== STACK TRACE ==============\n" +
                    info.stack +
                    "\n==========================================";
            }

            return m;
        })
    )
};

module.exports = new winston.createLogger(options);
