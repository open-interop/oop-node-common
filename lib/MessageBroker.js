const amqp = require("amqplib");
const logger = require("./logger");

const config = require("../config");

class MessageBroker {
    constructor(amqpAddress) {
        this.amqpAddress = amqpAddress;

        this._connect();
    }

    async publish(exchange, queue, message) {
        const channel = await this._getChannel();
        const buffer = Buffer.from(JSON.stringify(message));

        if (!channel.publish(exchange, queue, buffer)) {
            throw new Error(
                `Could not publish message to exchange ${exchange} with routing key ${queue}`
            );
        }
    }

    async create(queue, exchange, options = {}) {
        const channel = await this.channel;

        await channel.assertQueue(queue, options);
        await channel.bindQueue(queue, exchange, queue);
    }

    async consume(queue, consumer) {
        const channel = await this.channel;

        channel.consume(queue, message => {
            const content = message.content.toString();

            var messageData;

            try {
                messageData = JSON.parse(content);
            } catch (e) {
                logger.error(
                    `Error in message consumed from '${queue}', '${e}'.`
                );

                /* TODO: Maybe make this config. */
                this.publish(config.errorExchangeName, config.jsonErrorQ, {
                    error: String(e),
                    timestamp: new Date().toISOString(),
                    queue: queue,
                    content: content,
                    fields: message.fields,
                    properties: message.properties
                });

                channel.ack(message);

                return;
            }

            let wasAcked = false;

            const func = async () => {
                return consumer({
                    content: messageData,
                    ack: () => {
                        channel.ack(message);
                        wasAcked = true;
                    },
                    nack: () => {
                        channel.nack(message);
                        wasAcked = true;
                    }
                });
            };

            func()
                .then(() => {
                    if (!wasAcked) {
                        channel.ack(message);
                    }
                })
                .catch(err => {
                    if (!wasAcked) {
                        channel.nack(message);
                    }

                    logger.error(err);
                });
        });
    }

    async subscribe(exchange, consumer) {
        var channel = await this.channel;
        var queue = await channel.assertQueue("", { exclusive: true });

        await channel.bindQueue(queue.queue, exchange, "");

        this.consume(queue.queue, consumer);
    }

    /* PRIVATE METHODS */
    _connect() {
        this.connection = this._createConnection();
        this.channel = this._createChannel();
    }

    async _createConnection() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = false;
        }

        try {
            var connection = await amqp.connect(this.amqpAddress);
        } catch (e) {
            logger.error(e);

            return new Promise(resolve => {
                this.timeout = setTimeout(async () => {
                    this.timeout = false;
                    this._connect();

                    resolve(await this.connection);
                }, 5000);
            });
        }

        var handleError = err => {
            if (err) {
                logger.error(err);
            } else {
                logger.warn("AMQP server disconnected.");
            }

            this._connect();
        };

        connection.on("close", handleError);
        connection.on("error", handleError);

        return connection;
    }

    async _createChannel() {
        var connection = await this.connection;

        while (!connection) {
            this._connect();
            connection = await this.connection;
        }

        var channel = await connection.createChannel();

        var handleError = err => {
            if (err) {
                logger.error(err);
            } else {
                logger.warn("AMQP channel closed.");
            }

            this.channel = this._createChannel();
        };

        channel.on("close", handleError);
        channel.on("error", handleError);

        const prefetch = +config.queuePrefetchCount;
        if (prefetch) {
            channel.prefetch(prefetch);
        }

        return channel;
    }

    async _getChannel() {
        const res = await Promise.race([
            this.channel,
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        if (res) {
            return res;
        }

        throw new Error("Could not get AMQP channel.");
    }
}

module.exports = MessageBroker;
