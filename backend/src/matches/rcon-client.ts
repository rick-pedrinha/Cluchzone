import net from 'node:net';

const AUTH_PACKET_TYPE = 3;
const AUTH_RESPONSE_TYPE = 2;
const COMMAND_PACKET_TYPE = 2;
const COMMAND_RESPONSE_TYPE = 0;
const MAX_PACKET_SIZE = 4 * 1024 * 1024;

function packet(requestId: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, 'utf8');
  const size = payload.length + 10;
  const output = Buffer.allocUnsafe(size + 4);
  output.writeInt32LE(size, 0);
  output.writeInt32LE(requestId, 4);
  output.writeInt32LE(type, 8);
  payload.copy(output, 12);
  output.writeInt16LE(0, 12 + payload.length);
  return output;
}

export class RconClient {
  constructor(private readonly timeoutMs = 5_000) {}

  send(host: string, port: number, password: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      let buffer = Buffer.alloc(0);
      let authenticated = false;
      let finished = false;

      const complete = (error: Error | null, response = ''): void => {
        if (finished) return;
        finished = true;
        socket.destroy();
        if (error) reject(error);
        else resolve(response);
      };

      socket.setTimeout(this.timeoutMs);
      socket.once('timeout', () => complete(new Error('RCON request timed out.')));
      socket.once('error', error => complete(error));
      socket.once('connect', () => socket.write(packet(1, AUTH_PACKET_TYPE, password)));
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
          const size = buffer.readInt32LE(0);
          if (size < 10 || size > MAX_PACKET_SIZE) {
            complete(new Error('Invalid RCON packet size.'));
            return;
          }
          if (buffer.length < size + 4) return;
          const current = buffer.subarray(4, size + 4);
          buffer = buffer.subarray(size + 4);
          const requestId = current.readInt32LE(0);
          const type = current.readInt32LE(4);
          const body = current.subarray(8, current.length - 2).toString('utf8');

          if (!authenticated && type === AUTH_RESPONSE_TYPE) {
            if (requestId === -1) {
              complete(new Error('RCON authentication failed.'));
              return;
            }
            authenticated = true;
            socket.write(packet(2, COMMAND_PACKET_TYPE, command));
          } else if (authenticated && requestId === 2 && type === COMMAND_RESPONSE_TYPE) {
            complete(null, body);
            return;
          }
        }
      });
    });
  }
}
