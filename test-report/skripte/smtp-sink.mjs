// Lažni SMTP server samo na 127.0.0.1:2525 — hvata poruke u fajl, ništa ne šalje dalje.
import net from "node:net";
import { appendFileSync } from "node:fs";
const OUT = new URL("../mails.jsonl", import.meta.url).pathname;
net
  .createServer((socket) => {
    let buffer = "";
    let inData = false;
    let mail = { from: "", to: [], data: "" };
    socket.write("220 sink ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          mail.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          appendFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), ...mail }) + "\n");
          mail = { from: "", to: [], data: "" };
          socket.write("250 OK queued\r\n");
          continue;
        }
        const nl = buffer.indexOf("\r\n");
        if (nl === -1) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) socket.write("250-sink\r\n250 8BITMIME\r\n");
        else if (upper.startsWith("MAIL FROM")) { mail.from = line.slice(10); socket.write("250 OK\r\n"); }
        else if (upper.startsWith("RCPT TO")) { mail.to.push(line.slice(8)); socket.write("250 OK\r\n"); }
        else if (upper === "DATA") { inData = true; socket.write("354 go\r\n"); }
        else if (upper === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
    });
    socket.on("error", () => {});
  })
  .listen(2525, "127.0.0.1", () => console.log("smtp sink 127.0.0.1:2525"));
