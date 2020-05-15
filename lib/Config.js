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
            let env = confVars[varName];

            if (typeof env === "string") {
                env = { "name": env };
            } else if (!("name" in env)) {
                throw new Error(
                    `No environment variable specified for '${varName}'.`
                );
            }

            const value = process.env[env.name];

            if (value === undefined && !env.optional) {
                throw new Error(
                    `No value for required config variable '${env.name}' defined.`
                );
            }

            if (typeof value === "undefined") {
                value = env.default;
            }

            Object.defineProperty(this, var.name, {
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
