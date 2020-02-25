class Drain {
    constructor() {
        this.promise = Promise.resolve();
        this.isWaiting = false;
        this.resolver = () => {};
    }

    isUnblocked() {
        return this.promise;
    }

    block() {
        if (this.isWaiting) {
            return;
        }

        this.isWaiting = true;
        this.promise = new Promise(resolve => {
            this.resolver = resolve;
        });

        return this.promise;
    }

    unblock() {
        if (!this.isWaiting) {
            return;
        }

        this.isWaiting = false;
        this.resolver();
    }
}

module.exports = Drain;
