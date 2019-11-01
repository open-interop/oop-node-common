const dotenv = require("dotenv");

const logger = require("./logger");

class Config {
    constructor(confVars) {
        dotenv.config();

        Object.defineProperty(this, "confVars", {
            value: confVars,
            enumerable: false,
            writable: false
        });

        for (const varName in confVars) {
            const envName = confVars[varName];
            const value = process.env[envName];

            if (value === undefined) {
                throw new Error(
                    `No value for config variable '${envName}' defined.`
                );
            }

            Object.defineProperty(this, varName, {
                value: value,
                enumerable: true,
                writable: false
            });
        }

        this.printConfigVars();

        process.on("SIGUSR2", () => {
            this.printConfigVars();
        });
    }

    printConfigVars() {
        for (const varName in this) {
            const envName = this.confVars[varName];
            const value = this[varName];

            logger.info(`Running configuration: '${envName}': '${value}'.`);
        }
    }
}

module.exports = Config;
