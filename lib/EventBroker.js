const EventEmitter = require("events");

class EventBroker extends EventEmitter {
    async publish(exchange, queue, message) {
        this.emit(queue, message);
    }

    async consume(queue, consumer) {
        this.on(queue, message => {
            return consumer({
                content: message,
                ack: () => {},
                nack: () => {}
            });
        });
    }

    async subscribe(exchange, consumer) {
        this.consume(exchange, consumer);
    }
}

module.exports = EventBroker;
