const amqp = require("amqplib");
const logger = require("./logger");

const config = require("../config");
const Drain = require("./Drain");

const wait = millis => new Promise(resolve => setTimeout(resolve, millis));

class MessageBroker {
    constructor(amqpAddress) {
        this.amqpAddress = amqpAddress;
        this.consumers = [];
        this.connectionAttempts = 0;
        this.connection = null;
        this.channel = null;
        this.drain = new Drain();
    }

    async publish(exchange, queue, message) {
        const channel = await this.getChannel();
        const buffer = Buffer.from(JSON.stringify(message));

        await this.drain.isUnblocked();

        let retries = 0;
        let ret;
        while (
            retries < 10 &&
            !(ret = channel.publish(exchange, queue, buffer, {
                persistent: true
            }))
        ) {
            await this.drain.block();

            retries++;
        }

        if (!ret) {
            throw new Error("Unable to publish to queue.");
        }
    }

    async create(queue, exchange, options = {}) {
        const channel = await this.getChannel();

        await channel.assertQueue(queue, options);
        await channel.bindQueue(queue, exchange, queue);
    }

    async consume(queue, consumer, cacheConsumer = true) {
        const channel = await this.getChannel();

        if (cacheConsumer) {
            this.consumers.push({ queue, consumer });
        }

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
        var channel = await this.getChannel();
        var queue = await channel.assertQueue("", { exclusive: true });

        await channel.bindQueue(queue.queue, exchange, "");

        this.consume(queue.queue, consumer, false);
    }

    async getConnection() {
        while (!this.connection) {
            try {
                logger.info("Connecting...");
                this.connection = await amqp.connect(this.amqpAddress);

                this.connection.on("close", () => {
                    logger.info("Message Queue disconnected.");
                    this.connection = null;
                    this.reregisterConsumers();
                });
                this.connection.on("error", logger.error);
            } catch (e) {
                logger.error(e);

                await wait(5000);
            }
        }

        return this.connection;
    }

    async getChannel() {
        while (!this.channel) {
            var connection = await this.getConnection();

            try {
                logger.info("Creating channel...");
                this.channel = await connection.createChannel();

                this.channel.on("close", () => {
                    this.channel = null;
                    logger.info("Channel closed");
                });
                this.channel.on("error", logger.error);
                this.channel.on("drain", () => this.drain.unblock());

                const prefetch = +config.queuePrefetchCount;
                if (prefetch) {
                    this.channel.prefetch(prefetch);
                }
            } catch (e) {
                logger.error(e);

                await wait(5000);
            }
        }

        return this.channel;
    }

    async reregisterConsumers() {
        logger.info("Reregistering...");
        for (let { queue, consumer } of this.consumers) {
            logger.info(`Reregistering ${queue}.`);
            this.consume(queue, consumer, false);
        }
    }
}

module.exports = MessageBroker;
