const amqp = require("amqplib");
const logger = require("./logger");

const config = require("../config");
const Drain = require("./Drain");

const wait = millis => new Promise(resolve => setTimeout(resolve, millis));

class MessageBroker {
    constructor(amqpAddress) {
        this.amqpAddress = amqpAddress;
        this.consumers = [];
        this.subscribers = [];
        this.connectionAttempts = 0;

        this.connecting = false;
        this.channelling = false;

        this.connection = null;
        this.channel = null;
        this.drain = new Drain();
    }

    async publish(exchange, queue, message) {
        const channel = await this.getChannel();
        const buffer = Buffer.from(JSON.stringify(message));

        await this.drain.isUnblocked();

        if (exchange !== "") {
            try {
                await channel.checkExchange(exchange);
            } catch (e) {
                throw new Error(`Exchange ${exchange} doesn't exist, please check your config. (${e})`);
            }
        } else {
            await this.create(queue);
        }

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

    async create(queue) {
        if (queue.substr(0, 3) === "amq") {
            return;
        }

        const channel = await this.getChannel();
        await channel.assertQueue(queue, { durable: true });
    }

    async consume(queue, consumer, cacheConsumer = true) {
        const channel = await this.getChannel();

        if (cacheConsumer) {
            this.consumers.push({ queue, consumer });
        }

        await this.create(queue);

        channel.consume(queue, message => {
            const content = message.content.toString();

            var messageData;

            try {
                messageData = JSON.parse(content);
            } catch (e) {
                logger.error(
                    `Error in message consumed from '${queue}', '${e}'.`
                );

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

    async subscribe(exchange, consumer, cacheSubscriber = true) {
        var channel = await this.getChannel();
        var queue = await channel.assertQueue("", { exclusive: true });

        await channel.bindQueue(queue.queue, exchange, "");

        if (cacheSubscriber) {
            this.subscribers.push({ exchange, consumer });
        }

        this.consume(queue.queue, consumer, false);
    }

    async getConnection() {
        while (this.connecting) {
            await wait(1000);
        }

        this.connecting = true;

        while (!this.connection) {
            try {
                logger.info("Connecting to Message Queue.");
                this.connection = await amqp.connect(this.amqpAddress);

                this.connection.on("close", () => {
                    logger.info("Message Queue disconnected.");
                    this.connection = null;

                    this.getChannel();
                });

                this.connection.on("error", er => logger.error(er));

                this.getChannel();
            } catch (e) {
                logger.error(e);

                await wait(5000);
            }
        }

        this.connecting = false;

        return this.connection;
    }

    async getChannel() {
        while (this.channelling) {
            await wait(1000);
        }

        this.channelling = true;

        while (!this.channel) {
            var connection = await this.getConnection();

            try {
                logger.info("Creating Message Channel.");
                this.channel = await connection.createChannel();

                this.channel.on("close", () => {
                    this.channel = null;
                    logger.info("Message Channel Closed.");
                });
                this.channel.on("error", er => logger.error(er));
                this.channel.on("drain", () => this.drain.unblock());

                const prefetch = +config.queuePrefetchCount;
                if (prefetch) {
                    this.channel.prefetch(prefetch);
                }

                this.reregisterConsumers();
                this.reregisterSubscribers();
            } catch (e) {
                logger.error(e);

                await wait(5000);
            }
        }

        this.channelling = false;

        return this.channel;
    }

    async reregisterConsumers() {
        for (let { queue, consumer } of this.consumers) {
            this.consume(queue, consumer, false);
        }
    }

    async reregisterSubscribers() {
        for (let { exchange, consumer } of this.subscribers) {
            this.subscribe(exchange, consumer, false);
        }
    }
}

module.exports = MessageBroker;
