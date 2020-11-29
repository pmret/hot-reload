console.clear()

var MAJOR_VERSION = 1
var MINOR_VERSION = 0
var PATCH_VERSION = 0

console.log("hot-reload " + MAJOR_VERSION + "." + MINOR_VERSION + "." + PATCH_VERSION)

if (mem.getstring(0xB0000020, 11) != "PAPER MARIO") {
    console.log("WARNING: open ROM does not appear to be Paper Mario (U)")
}

var hotBgm = []

// Immediately after al_copy call
events.onexec(0x80053DAC, function () {
    if (hotBgm.length > 0) {
        console.log("Replacing in-memory BGM")
    }

    for (var i = 0; i < hotBgm.length; i++) {
        mem.u8[0x801DA070 + i] = hotBgm[i]
    }

    hotBgm = []
})

var socket = new Socket()

function sendPacket(message, data) {
    console.log("Sending " + message)

    const header = new Buffer(0x14)
    header.write(message, 0x00)
    header.writeInt32BE(data.length, 0x10)

    const buffer = Buffer.concat([header, data], data.length + 0x14)

    socket.write(buffer)
}

function handlePacket(message, data) {
    console.log("Recieved " + message)

    switch (message) {
    case "PING": {
        var buffer = new Buffer(3)
        buffer[0] = MAJOR_VERSION
        buffer[1] = MINOR_VERSION
        buffer[2] = PATCH_VERSION

        sendPacket("PONG", buffer)

        break
    }
    case "MEMORY_SET": {
        var vaddr = data[3] | (data[2] << 8) | (data[1] << 16) | (data[0] << 24)

        console.log("Writing memory at vaddr " + vaddr.hex())

        for (var i = 4; i < data.length; i++) {
            mem.u8[vaddr + i - 4] = data[i]
        }

        break
    }
    case "HOT_BGM": {
        hotBgm = data

        // gMusicPlayers[0]
        mem.u16[0x80159AF2] = 1 // fadeState = fade out
        mem.u32[0x80159AF4] = 0 // fadeOutTime
        mem.u32[0x80159AF8] = 0 // fadeInTime
        mem.u32[0x80159B00] = 0 // new song ID = Toad Town

        break
    }
    case "PONG":
    case "ERROR":
        break
    default: {
        var buffer = new Buffer(0x10)
        buffer.write(message, 0x00)
        sendPacket("ERROR", buffer)
    }
    }
}

// Buffer.prototype.slice ponyfill
function sliceBuffer(buffer, offset) {
    var buf = new Buffer(buffer.length - offset)

    for (var i = offset; i < buffer.length; i++) {
        buf[i - offset] = buffer[i]
    }

    return buf
}


console.log("Connecting...")

socket.connect({ port: 65432 }, function () {
    console.log("Connected to server")

    sendPacket("PING", new Buffer(0))
})

var message, dataSize, data, isBuffering = false
socket.on("data", function (buffer) {
    if (!isBuffering) {
        message = buffer.toString("ascii", 0x00, 0x10)
        dataSize = buffer[0x13] | (buffer[0x12] << 8) | (buffer[0x11] << 16) | (buffer[0x10] << 24)
        data = sliceBuffer(buffer, 0x14)

        // Strip at null terminator, if any
        for (var i = 0; i < message.length; i++) {
            if (message[i] == "\0") {
                message = message.slice(0, i)
                break
            }
        }

        isBuffering = true
    } else {
        var buf = new Buffer(data.length + buffer.length)

        for (var i = 0; i < data.length; i++) {
            buf[i] = data[i]
        }

        for (var i = 0; i < buffer.length; i++) {
            buf[data.length + i] = buffer[i]
        }

        data = buf
    }

    if (data.length >= dataSize) {
        isBuffering = false
        handlePacket(message, data)
    }
})

socket.on("close", function () {
    console.log("Lost connection to server")
    console.log("Restart this script to reconnect")
})
