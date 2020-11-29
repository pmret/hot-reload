const net = require("net")

const MAJOR_VERSION = 1
const MINOR_VERSION = 0
const PATCH_VERSION = 0

class Server {
    constructor() {
        this.packetHandlers = {}
        this.connected = []
        this.server = net.createServer(socket => {
            socket.setKeepAlive(true)

            socket.on("error", error => {
                console.error(error)

                socket.end()
                socket.destroy()
            })

            socket.on("close", () => {
                if (this.packetHandlers[Server.DISCONNECT]) {
                    for (const handler of this.packetHandlers[Server.DISCONNECT]) {
                        handler(socket)
                    }
                }
            })

            let message, dataSize, data
            socket.on("data", buffer => {
                if (!message) {
                    message = buffer.toString("ascii", 0x00, 0x10)
                    dataSize = buffer.readInt32BE(0x10)
                    data = buffer.subarray(0x14)

                    // Strip at null terminator, if any
                    for (let i = 0; i < message.length; i++) {
                        if (message[i] == "\0") {
                            message = message.slice(0, i)
                            break
                        }
                    }
                } else {
                    data = Buffer.concat([data, buffer])
                }

                if (data.length >= dataSize) {
                    if (this.packetHandlers[message]) {
                        for (const handler of this.packetHandlers[message]) {
                            handler(data, socket)
                        }
                    } else {
                        this.send("ERROR", Buffer.from(message, "ascii"), [socket])
                    }

                    message = null
                    dataSize = null
                    data = null
                }
            })

            this.connected.push(socket)
            this.send("PING", new Uint8Array(), [socket])
        })

        this.on("PING", (data, socket) => {
            this.send(
                "PONG",
                new Uint8Array([MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION]),
                [socket]
            )
        })

        this.on("PONG", (data, socket) => {
            if (data[0] !== MAJOR_VERSION) {
                socket.end()
                socket.destroy()
            }
        })

        this.on("ERROR", (data, socket) => {
            // Ignore it; don't respond with ERROR.
        })
    }

    /**
     * @param [options] {object}
     */
    listen(options={}) {
        this.server.listen(Object.assign({ port: 65432 }, options))
    }

    /**
     * Sends a packet.
     * @param message {string}
     * @param data {Uint8Array}
     * @param [clients] {array} Defaults to all connected clients.
     */
    send(message, data, clients) {
        if (!clients) {
            clients = this.connected
        }

        const header = Buffer.alloc(0x14)
        header.write(message, 0x00, "ascii")
        header.writeUInt32BE(data.length, 0x10)

        const buffer = Buffer.concat([header, data], data.length + 0x14)

        for (const socket of clients) {
            if (socket && !socket.destroyed) {
                socket.write(buffer)
            }
        }
    }

    /**
     * Adds a packet handler.
     * @param message {string}
     * @param callback {function}
     */
    on(message, callback) {
        if (this.packetHandlers[message]) {
            this.packetHandlers[message].push(callback)
        } else {
            this.packetHandlers[message] = [callback]
        }
    }

    /**
     * Removes a packet handler.
     * @param message {string}
     * @param callback {function}
     */
    off(message, callback) {
        if (this.packetHandlers[message]) {
            const index = this.packetHandlers[messages].findIndex(callback)

            if (index !== -1) {
                this.packetHandlers[message].splice(index, 1)
            }
        }
    }

    /**
     * Clears all packet handlers. Note that this also clears default packet handlers.
     */
    clear() {
        this.packetHandlers = {}
    }

    setMemory(vaddr, data, clients) {
        const buffer = Buffer.alloc(4)
        buffer.writeUInt32BE(vaddr, 0)

        this.send("MEMORY_SET", Buffer.concat([buffer, data], data.length + 4), clients)
    }

    hotBgm(data, clients) {
        this.send("HOT_BGM", data, clients)
    }
}

Server.DISCONNECT = Symbol("disconnect")

module.exports = {
    MAJOR_VERSION,
    MINOR_VERSION,
    Server,
}
