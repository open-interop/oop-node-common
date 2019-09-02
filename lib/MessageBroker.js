const amqp = require("amqplib");
const logger = require("./logger");

class MessageBroker {
    constructor(amqpAddress) {
        this.amqpAddress = amqpAddress;

        this.connection = this._getConnection();
        this.channel = this._getChannel();
    }

    async publish(exchange, queue, message) {
        const channel = await this.channel;
        const buffer = Buffer.from(JSON.stringify(message));

        if (!channel.publish(exchange, queue, buffer)) {
            throw new Error(
                `Could not publish message to exchange ${exchange} with routing key ${queue}`
            );
        }
    }

    async consume(queue, consumer) {
        const channel = await this.channel;

        channel.consume(queue, message => {
            const content = message.content.toString();
            const messageData = JSON.parse(content);

            let wasAcked = false;

            Promise.resolve(
                consumer({
                    content: messageData,
                    ack: () => {
                        channel.ack(message);
                        wasAcked = true;
                    },
                    nack: () => {
                        channel.nack(message);
                        wasAcked = true;
                    }
                })
            )
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

        await channel.bindQueue(
            queue.queue,
            exchange,
            ""
        );

        this.consume(queue.queue, consumer);
    }

    /* PRIVATE METHODS */
    async _getConnection() {
        var connection = await amqp.connect(this.amqpAddress);

        var handleError = err => {
            if (err) {
                logger.error(err);
            } else {
                logger.warn("AMQP server disconnected.");
            }

            this.connection = this._getConnection();
        };

        connection.on("close", handleError);
        connection.on("error", handleError);

        return connection;
    }

    async _getChannel() {
        var connection = await this.connection;
        var channel = await connection.createChannel();

        var handleError = err => {
            if (err) {
                logger.error(err);
            } else {
                logger.warn("AMQP channel closed.");
            }

            this.channel = this._getChannel();
        };

        channel.on("close", handleError);
        channel.on("error", handleError);

        return channel;
    }
}

module.exports = MessageBroker;
