var protocol = require('./protocol');

module.exports = function (cmd, opts) {
  return exports[cmd](opts);
};

/* Connack */
exports.connack = function (opts) {
  var opts = opts || {}
    , rc = opts.returnCode || 0
    , packet;

  /* Check required fields */
  if (typeof rc !== 'number' || (rc < 0) || (rc > 5)) return null;

  /* Generate packet */
  packet = new Buffer(4);
  packet[0] = protocol.codes['connack'] << protocol.CMD_SHIFT;
  packet[1] = 2;
  packet[2] = 0;
  packet[3] = rc;

  return packet;
};

/* Publish */
exports.publish = function (opts) {
  var opts = opts || {}
    , dup = opts.dup ? protocol.DUP_MASK : 0
    , qos = opts.qos || 0
    , retain = opts.retain ? protocol.RETAIN_MASK : 0
    , topic = opts.topic
    , payload = opts.payload
    , id = (opts.messageId === undefined) ? randid() : opts.messageId
    , packet;

  /* Check required fields */
  if (typeof topic !== 'string' || !topic) return null;
  if (!Buffer.isBuffer(payload) && typeof payload !== 'string') return null;
  if (typeof qos !== 'number' || qos < 0 || qos > 2) return null;
  if (typeof id !== 'number' || id < 0 || id > 0xFFFF) return null;

  /* Length of fields */
  var tlen = Buffer.byteLength(topic)
    , plen = (!Buffer.isBuffer(payload) ? Buffer.byteLength(payload) : payload.length)
    , rlen = 2 + tlen + (qos > 0 ? 2 : 0) + plen
    , llen = rlen_len(rlen)
    , pos = 0;

  /* Check valid */
  if (llen < 0) return null;

  /* Generate packet */
  packet = new Buffer(1 + llen + rlen);

  /* Header */
  packet[pos] = protocol.codes['publish'] << protocol.CMD_SHIFT |
    dup | qos << protocol.QOS_SHIFT | retain;
  pos += 1;

  /* Length */
  rlen_gen(rlen, packet, pos);
  pos += llen;

  /* Topic */
  packet.writeUInt16BE(tlen, pos);
  packet.write(topic, pos + 2);
  pos += 2 + tlen;

  /* Message Id */
  if (qos > 0) {
    packet.writeUInt16BE(id, pos);
    pos += 2;
  }

  /* Payload */
  if (!Buffer.isBuffer(payload)) {
    packet.write(payload, pos);
  } else {
    payload.copy(packet, pos);
  }

  return packet;
};

/* Pingresp */
exports.pingresp = function (opts) {
  var self = exports.pingresp
    , packet = self.packet;

  if (packet === undefined) {
    /* Generate packet */
    packet = self.packet = new Buffer(2);
    packet[0] = protocol.codes['pingresp'] << protocol.CMD_SHIFT;
    packet[1] = 0;
  }

  return packet;
};

/* Privates */
function rlen_len(len) {
  if (len <= 127) return 1;
  if (len <= 16383) return 2;
  if (len <= 2097151) return 3;
  if (len <= 268435455) return 4;
  return -1;
}

function rlen_gen(len, buf, pos) {
  var digit;

  do {
    digit = len % 128 | 0;
    len = len / 128 | 0;
    if (len > 0) {
        digit = digit | 0x80;
    }
    buf[pos++] = digit;
  } while (len > 0);

  return pos;
}

function randid() {
  return ~~(Math.random() * 0x10000);
}