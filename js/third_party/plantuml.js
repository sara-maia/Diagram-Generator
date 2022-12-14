const deflate = require("./rawdeflate");

function decode6bit(n) {
  return n >= "0" && n <= "9"
    ? n.charCodeAt(0) - 48
    : n >= "A" && n <= "Z"
    ? n.charCodeAt(0) - 55
    : n >= "a" && n <= "z"
    ? n.charCodeAt(0) - 61
    : n == "-"
    ? 62
    : n == "_"
    ? 63
    : 0;
}
function decode64(n) {
  var t = "";
  for (i = 0; i < n.length; i += 4) {
    var f = decode6bit(n.substring(i, i + 1)),
      r = decode6bit(n.substring(i + 1, i + 2)),
      u = decode6bit(n.substring(i + 2, i + 3)),
      e = decode6bit(n.substring(i + 3, i + 4));
    t += String.fromCharCode((f << 2) | (r >> 4));
    t += String.fromCharCode(((r & 15) << 4) | (u >> 2));
    t += String.fromCharCode(((u & 3) << 6) | e);
  }
  var o = RawDeflate.inflate(t),
    s = escape(o);
  return decodeURIComponent(s);
}
function encode64(n) {
  for (r = "", i = 0; i < n.length; i += 3)
    r +=
      i + 2 == n.length
        ? append3bytes(n.charCodeAt(i), n.charCodeAt(i + 1), 0)
        : i + 1 == n.length
        ? append3bytes(n.charCodeAt(i), 0, 0)
        : append3bytes(
            n.charCodeAt(i),
            n.charCodeAt(i + 1),
            n.charCodeAt(i + 2)
          );
  return r;
}
function append3bytes(n, t, i) {
  return (
    (c1 = n >> 2),
    (c2 = ((n & 3) << 4) | (t >> 4)),
    (c3 = ((t & 15) << 2) | (i >> 6)),
    (c4 = i & 63),
    (r = ""),
    (r += encode6bit(c1 & 63)),
    (r += encode6bit(c2 & 63)),
    (r += encode6bit(c3 & 63)),
    (r += encode6bit(c4 & 63))
  );
}
function encode6bit(n) {
  return n < 10
    ? String.fromCharCode(48 + n)
    : ((n -= 10), n < 26)
    ? String.fromCharCode(65 + n)
    : ((n -= 26), n < 26)
    ? String.fromCharCode(97 + n)
    : ((n -= 26), n == 0)
    ? "-"
    : n == 1
    ? "_"
    : "?";
}
function compress(n) {
  n = unescape(encodeURIComponent(n));
  var u = deflate(n);
  return encode64(u);
  //   var u = deflate(n),
  //     i = encode64(u),
  //     t = "https://www.plantuml.com/plantuml/svg/";
  //   t =
  //     t.trim() == ""
  //       ? location.protocol +
  //         "//" +
  //         location.hostname +
  //         (location.port ? ":" + location.port : "") +
  //         "/api/plantuml/"
  //       : t.endsWith("/")
  //       ? t
  //       : t.concat("/");
  //   var finalUrl = t + i;
  //   console.log("Diagram Link: " + finalUrl);
  //   return finalUrl;
}
UTF8 = {
  encode: function (n) {
    return unescape(encodeURIComponent(n));
  },
  decode: function (n) {
    return decodeURIComponent(escape(n));
  },
};
Base64 = {
  encode: function (n) {
    return btoa(n);
  },
  decode: function (n) {
    return atob(n);
  },
};

module.exports = compress;
