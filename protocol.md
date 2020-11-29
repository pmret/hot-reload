This document describes hot-reload protocol **1**. This version number will be incremented when breaking changes are made.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",  "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://tools.ietf.org/html/rfc2119).

The key word "implementation" or "implementer" is to be understood as any server, client, or persons adhering to the hot-reload protocol described in this document.

---

### Types

In this document:

`u8` refers to an unsigned 8-bit integer byte.

`u32` refers to an unsigned 32-bit big-endian integer.

`char` refers to an ASCII character byte.

### Communication vector

Communication SHOULD occur over a TCP socket `localhost` port `65432`. Server and client implementations MAY choose to support configuration options to change the communication vector (such as over a different port).

### Packets

All communications from implementers MUST be in the following form:
```c
struct {
    /* 0x00 */ char[16] message; // ASCII, no null-terminator required
    /* 0x10 */ u32      data_size;
    /* 0x14 */ u8       data[data_size];
} packet;

sizeof(packet) == data_size + 0x14
```

### Required message types

Implementers MUST support the following message types.

If a packet with a data_size larger than defined in this document is received, it is RECOMMENDED the receiver attempt to handle it as usual. However, a receiver MAY respond with an "ERROR" message as described below.

#### PING

```c
struct {
    /* 0x00 */ char[16] message = "PING";
    /* 0x10 */ u32      data_size = 0;
};
```

A "PING" message requests that the receiver respond with a "PONG" message.

Implementers MUST send a "PING" message immediately upon connection to verify that they support the same version of this specification.

If a "PING" message is not responded to in adequate time, the sender MAY choose to terminate the connection.

#### PONG

```c
struct {
    /* 0x00 */ char[16] message = "PONG";
    /* 0x10 */ u32      data_size = 3;
    /* 0x14 */ u8       major_version = 1;
    /* 0x15 */ u8       minor_version;
    /* 0x16 */ u8       patch_version;
};
```

A "PONG" message SHOULD be sent only in response to a "PING" message.

Upon receiving a "PONG" message in response to its "PING", implementors SHOULD verify that `major_version` is **equal** to the version of this specification the receiver implements. If this is not the case, the implementor SHOULD terminate the connection.

#### ERROR

```c
struct {
    /* 0x00 */ char[16] message = "ERROR";
    /* 0x10 */ u32      data_size = 16;
    /* 0x14 */ char[16] bad_message;
};
```

If an implementer does not recognise or implement a message type that has just been received, it MUST respond with a packet with message "ERROR" and data the message that was originally sent.

An "ERROR" packet MAY be sent with the data described above upon receiving a malformed packet (e.g. data_size inconsistent with the data_size explicitly described in this document for that message).

A packet receiver which encounters an error whilst handling or responding to the received packet SHOULD respond with an "ERROR" packet. In cases where this is not possible (e.g. fatal errors), it is RECOMMENDED that the connection is terminated or ignore further communications. A similar process SHOULD be followed where an implementer realises that this specification is not being followed by the other party.

The receiver of an "ERROR" packet MAY choose to ignore it.

#### MEMORY_SET

```c
struct {
    /* 0x00 */ char[16] message = "MEMORY_SET";
    /* 0x10 */ u32      data_size = 4 + mem_size;
    /* 0x14 */ u32      start_vaddr;
    /* 0x18 */ u8       mem[mem_size];
};
```

Requests that the receiver set the memory at `start_vaddr` to `mem`.

This message MUST only be sent by servers. The receiver SHOULD NOT respond if setting memory is successful.


#### HOT_BGM

```c
struct {
    /* 0x00 */ char[16]      message = "H0T_BGM";
    /* 0x10 */ u32           data_size;
    /* 0x14 */ u8            bgm[];
};
```

Instructs the receiving client to replace the current music track with the given BGM data `bgm` and immediately play it.

This message MUST only be sent by servers.

### Bespoke message types

For compatibility, it is RECOMMENDED that any message supported by implementers not defined in this specification use lower-case.
