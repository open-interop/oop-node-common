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
            const env = this._getEnvDefinition(varName, confVars);
            const value = this._getEnvValue(env);

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
            const env = this._getEnvDefinition(varName, this.confVars);
            const value = this[varName];

            logger.info(`Running configuration: '${env.name}': '${value}'.`);
        }
    }

    _getEnvDefinition(varName, confVars) {
        const env = confVars[varName];

        if (typeof env === "string") {
            return { "name": env };
        } else if (!("name" in env)) {
            throw new Error(
                `No environment variable specified for '${varName}'.`
            );
        }

        return env;
    }

    _getEnvValue(env) {
        const value = process.env[env.name];

        if (value === undefined && !env.optional) {
            throw new Error(
                `No value for required config variable '${env.name}' defined.`
            );
        }

        if (typeof value === "undefined") {
            return env.default;
        } else {
            return value;
        }
    }
}

module.exports = Config;
