const Config = require("./lib/Config");

module.exports = new Config({
    errorExchangeName: "OOP_ERROR_EXCHANGE_NAME",
    jsonErrorQ: "OOP_JSON_ERROR_Q",
    queuePrefetchCount: "OOP_QUEUE_PREFETCH_LIMIT"
});
