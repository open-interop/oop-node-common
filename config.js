const dotenv = require("dotenv");

dotenv.config();

module.exports = {
    errorExchangeName: process.env.OOP_ERROR_EXCHANGE_NAME,
    jsonErrorQ: process.env.OOP_JSON_ERROR_Q,
};
